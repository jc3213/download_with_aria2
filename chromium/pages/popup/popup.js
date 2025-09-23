let aria2RPC;
let aria2Tasks = new Map();
let aria2Stats = new Map();
let aria2Focus = new Set();
let aria2Queue = {};
let aria2Group = {
    active: 'active',
    paused: 'waiting',
    waiting: 'waiting',
    complete: 'stopped',
    removed: 'stopped',
    error: 'stopped'
};
let aria2Filter;
let aria2Proxy = '';
let aria2Delay = 'http://127.0.0.1:1230/';
let aria2Interval;

let [menuPane, filterPane, statusPane, queuePane, template] = document.body.children;
let [downBtn, purgeBtn, optionsBtn] = menuPane.children;
let [i18nEntry, verEntry, ...statEntries] = statusPane.children;
let [sessionLET, fileLET, uriLET] = template.children;

statEntries.forEach((stat) => aria2Stats.set(stat.id, stat));

const shortcutMap = {
    'e': purgeBtn,
    'd': downBtn,
    'q': optionsBtn
};

document.addEventListener('keydown', (event) => {
    let key = shortcutMap[event.key];
    if (key && event.ctrlKey) {
        event.preventDefault();
        key.click();
    }
});

function taskFilters(array, saveFn) {
    let filters = new Set(Array.isArray(array) ? array : []);
    let manager = document.body.classList;
    manager.add(...filters);
    aria2Filter = (id) => {
        if (filters.has(id)) {
            filters.delete(id);
            manager.remove(id);
        } else {
            filters.add(id);
            manager.add(id);
        }
        saveFn?.([...filters]);
    };
}

filterPane.addEventListener('click', (event) => {
    let id = event.target.id.slice(2);
    aria2Filter?.(id);
});

purgeBtn.addEventListener('click', async (event) => {
    await aria2RPC.call({ method: 'aria2.purgeDownloadResult' });
    let { stopped } = aria2Queue;
    stopped.forEach((gid) => {
        aria2Tasks.get(gid).remove();
        aria2Tasks.delete(gid);
    });
    stopped.clear();
    aria2Stats.get('stopped').textContent = '0';
});

function aria2ClientSetup(scheme, jsonrpc, secret) {
    aria2RPC = new Aria2(scheme, jsonrpc, secret);
    aria2RPC.onopen = aria2ClientOpened;
    aria2RPC.onclose = aria2ClientClosed;
    aria2RPC.onmessage = aria2ClientMessage;
}

function updateManager(stats, active) {
    let { downloadSpeed, uploadSpeed } = stats.result;
    aria2Stats.get('download').textContent = getFileSize(downloadSpeed);
    aria2Stats.get('upload').textContent = getFileSize(uploadSpeed);
    active.result.forEach(taskElementUpdate);
}

async function aria2ClientOpened() {
    aria2RPC.call(
        { method: 'aria2.getGlobalStat' }, { method: 'aria2.getVersion' },
        { method: 'aria2.tellActive' }, { method: 'aria2.tellWaiting', params: [0, 999] }, { method: 'aria2.tellStopped', params: [0, 999] }
    ).then(([stats, version, active, waiting, stopped]) => {
        aria2Queue.active  = new Set();
        aria2Queue.waiting = new Set();
        aria2Queue.stopped = new Set();
        updateManager(stats, active);
        waiting.result.forEach(taskElementUpdate);
        stopped.result.forEach(taskElementUpdate);
        verEntry.textContent = version.result.version;
        aria2Interval = setInterval(() => aria2RPC.call({ method: 'aria2.getGlobalStat' }, { method: 'aria2.tellActive' })
            .then(([stats, active]) => updateManager(stats, active)), aria2Delay);
    }).catch(aria2ClientClosed);
}

function aria2ClientClosed() {
    clearInterval(aria2Interval);
    aria2Tasks.clear();
    aria2Stats.values().forEach((stat) => stat.textContent = '0');
    queuePane.innerHTML = '';
    verEntry.textContent = 'N/A';
}

function aria2ClientMessage({ method, params }) {
    if (method === 'aria2.onBtDownloadComplete') {
        return;
    }
    let [{ gid }] = params;
    let group = method === 'aria2.onDownloadStart' ? 'waiting' : 'active';
    taskElementRefresh(gid);
    taskRemoved(gid, group);
}

function taskRemoved(gid, group) {
    let queue = aria2Queue[group];
    queue.delete(gid);
    aria2Stats.get(group).textContent = queue.size;
}

function taskUpdated(task, gid, status) {
    let group = aria2Group[status];
    let queue = aria2Queue[group];
    queue.add(gid);
    aria2Stats.get(group).textContent = queue.size;
    task.classList.replace(task.status, status);
    task.status = status;
    queuePane.appendChild(task);
}

async function taskElementRefresh(gid) {
    let [{ result }] = await aria2RPC.call({ method: 'aria2.tellStatus', params: [gid] });
    let task = taskElementUpdate(result);
    if (aria2Focus.has(gid)) {
        task.scrollIntoView({ block: 'start', inline: 'nearest' });
        aria2Focus.delete(gid);
    }
    taskUpdated(task, gid, result.status);
}

function taskElementUpdate({ gid, status, files, bittorrent, completedLength, totalLength, downloadSpeed, uploadSpeed, connections, numSeeders }) {
    let task = aria2Tasks.get(gid) ?? taskElementCreate(gid, status, bittorrent, files);
    let time = (totalLength - completedLength) / downloadSpeed;
    let days = time / 86400 | 0;
    let hours = time / 3600 - days * 24 | 0;
    let minutes = time / 60 - days * 1440 - hours * 60 | 0;
    let seconds = time - days * 86400 - hours * 3600 - minutes * 60 | 0;
    let percent = (completedLength / totalLength * 10000 | 0) / 100;
    let [{ path, uris }] = files;
    task.name.textContent ||= bittorrent?.info?.name ?? path?.slice(path.lastIndexOf('/') + 1) ?? uris[0]?.uri ?? gid;
    task.current.textContent = getFileSize(completedLength);
    task.total.textContent = getFileSize(totalLength);
    task.day.textContent = days || '';
    task.hour.textContent = hours || '';
    task.minute.textContent = minutes || '';
    task.second.textContent = seconds || '';
    task.network.textContent = bittorrent ? connections + '(' + numSeeders + ')' : connections;
    task.download.textContent = getFileSize(downloadSpeed);
    task.upload.textContent = getFileSize(uploadSpeed);
    task.ratio.textContent = percent;
    task.ratio.style.width = percent + '%';
    files.forEach(({ index, length, path, completedLength }) => {
        let { name, ratio } = task[index];
        name.textContent ||= path?.slice(path.lastIndexOf('/') + 1);
        ratio.textContent = (completedLength / length * 10000 | 0) / 100;
    });
    return task;
}

async function taskRemoveHandler(task, gid, method, group) {
    await aria2RPC.call({ method, params: [gid] });
    taskRemoved(gid, group);
    aria2Tasks.delete(gid);
    task.remove();
}

const taskRemoveMap = {
    'active': (task, gid) => aria2RPC.call({ method: 'aria2.forceRemove', params: [gid] }),
    'waiting': (task, gid) => taskRemoveHandler(task, gid, 'aria2.forceRemove', 'waiting'),
    'paused': (task, gid) => taskRemoveHandler(task, gid, 'aria2.forceRemove', 'waiting'),
    'complete': (task, gid) => taskRemoveHandler(task, gid, 'aria2.removeDownloadResult', 'stopped'),
    'removed': (task, gid) => taskRemoveHandler(task, gid, 'aria2.removeDownloadResult', 'stopped'),
    'error': (task, gid) => taskRemoveHandler(task, gid, 'aria2.removeDownloadResult', 'stopped'),
};

const taskPauseMap = {
    'active': (task, gid) => aria2RPC.call({ 'method': 'aria2.forcePause', 'params': [gid] }),
    'waiting': (task, gid) => aria2RPC.call({ 'method': 'aria2.forcePause', 'params': [gid] }),
    'paused': (task, gid) => aria2RPC.call({ 'method': 'aria2.unpause', 'params': [gid] })
};

async function taskDetailHandler(gid) {
    let [{ result: files }, { result: options }] = await aria2RPC.call({ method: 'aria2.getFiles', params: [gid] }, { method: 'aria2.getOption', params: [gid] });
    options['min-split-size'] = getFileSize(options['min-split-size']);
    options['max-download-limit'] = getFileSize(options['max-download-limit']);
    options['max-upload-limit'] = getFileSize(options['max-upload-limit']);
    return { files, options };
}

async function taskEventDetail(task, gid) {
    let { classList, checks, entries, apply } = task;
    if (classList.contains('expand')) {
        apply.classList.add('hidden');
        classList.remove('expand');
    } else {
        let { files, options } = await taskDetailHandler(gid);
        let config = {};
        files.forEach(({ index, selected }) => {
            checks.get(index).checked = selected === 'true';
        });
        entries.forEach((entry) => {
            let { name } = entry;
            entry.value = config[name] = options[name] ?? '';
        });
        task.config = config;
        classList.add('expand');
    }
}

async function taskEventApply(task, gid) {
    let { checks, config, apply } = task;
    let selected = [];
    checks.forEach((check, index) => {
        if (check.checked) {
            selected.push(index);
        }
    });
    config['select-file'] = selected;
    aria2Focus.add(gid);
    await aria2RPC.call({ method: 'aria2.changeOption', params: [gid, config] });
    apply.classList.add('hidden');
}

async function taskEventRetry(task, gid) {
    let { files, options } = await taskDetailHandler(gid);
    let [{ path, uris }] = files;
    let url = uris.map(({ uri }) => uri);
    let match = path?.match(/^((?:[A-Z]:)?(?:\/[^/]+)*)\/([^/]+)$/);
    if (match) {
        options['dir'] = match[1];
        options['out'] = match[2];
    }
    let [{ result }] = await aria2RPC.call({ method: 'aria2.addUri', params: [url, options] }, { method: 'aria2.removeDownloadResult', params: [gid] });
    taskElementRefresh(result);
    taskRemoved(gid, 'stopped');
    aria2Tasks.delete(gid);
    task.remove();
}

function taskEventProxy(task) {
    task.config['all-proxy'] = task.proxy.value = aria2Proxy;
    task.apply.classList.remove('hidden');
}

async function taskUriAdded(task, gid) {
    let url = task.newuri.value;
    task.newuri.value = '';
    let [{ result }] = await aria2RPC.call({ method: 'aria2.changeUri', params: [gid, 1, [], [url]] });
    if (result?.[1] === 1) {
        aria2Focus.add(gid);
        task[url] ??= taskUriElement(task, url);
    }
}

async function taskUriRemoved(task, gid, event) {
    let { files } = await taskDetailHandler(gid);
    let [{ uris }] = files;
    let url = event.target.previousElementSibling.textContent;
    let removed = uris.filter(({ uri }) => uri === url).map(({ uri }) => uri);
    let [{ result }] = await aria2RPC.call({ method: 'aria2.changeUri', params: [gid, 1, removed, []] });
    if (result?.[0] === removed.length) {
        aria2Focus.add(gid);
        delete task[url];
        event.target.parentNode.remove();
    }
}

const taskEventMap = {
    'tips_task_remove': (task, gid) => taskRemoveMap[task.status]?.(task, gid),
    'tips_task_pause': (task, gid) => taskPauseMap[task.status]?.(task, gid),
    'tips_task_detail': taskEventDetail,
    'tips_task_apply': taskEventApply,
    'tips_task_retry': taskEventRetry,
    'tips_proxy_server': taskEventProxy,
    'tips_uri_add': taskUriAdded,
    'tips_uri_copy': ($, _, event) => navigator.clipboard.writeText(event.target.textContent),
    'tips_uri_remove': taskUriRemoved,
    'tips_file_index': (task) => task.apply.classList.remove('hidden')
};

function taskElementCreate(gid, status, bittorrent, files) {
    let task = sessionLET.cloneNode(true);
    let [name, current, time, total, network, download, upload, menu, meter, options, flist, ulist] = task.children;
    let [day, hour, minute, second] = time.children;
    let apply = menu.children[2];
    let ratio = meter.children[0];
    let newuri = ulist.children[0].children[1];
    let entries = options.querySelectorAll('[name]');
    task.name = name;
    task.current = current;
    task.day = day;
    task.hour = hour;
    task.minute = minute;
    task.second = second;
    task.total = total;
    task.network = network;
    task.download = download;
    task.upload = upload;
    task.ratio = ratio;
    task.apply = apply;
    task.entries = entries;
    task.flist = flist;
    task.ulist = ulist;
    task.newuri = newuri;
    task.proxy = entries[2];
    task.checks = new Map();
    task.id = gid;
    task.classList.add(status, bittorrent ? 'p2p' : 'http');
    task.addEventListener('click', (event) => {
        let menu = event.target.getAttribute('i18n-tips');
        taskEventMap[menu]?.(task, gid, event);
    });
    task.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault();
            apply.click();
        }
    });
    newuri.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            taskUriAdded(task, gid);
        }
    });
    options.addEventListener('change', (event) => {
        task.config[event.target.name] = event.target.value;
        apply.classList.remove('hidden');
    });
    files.forEach(({ index, length, path, selected, uris }) => {
        task[index] ??= taskFileElement(task, gid, index, selected, path, length);
        uris.forEach(({ uri, status }) => {
            task[uri] ??= taskUriElement(task, uri);
        });
    });
    taskUpdated(task, gid, status);
    aria2Tasks.set(gid, task);
    return task;
}

function taskFileElement(task, gid, index, selected, path, length) {
    let file = fileLET.cloneNode(true);
    let [check, label, name, size, ratio] = file.children;
    check.id = gid + '_' + index;
    check.checked = selected === 'true';
    label.textContent = index;
    label.setAttribute('for', check.id);
    name.textContent = path.slice(path.lastIndexOf('/') + 1);
    name.title = path;
    size.textContent = getFileSize(length);
    task.checks.set(index, check);
    task.flist.appendChild(file);
    return { name, ratio };
}

function taskUriElement(task, uri) {
    let url = uriLET.cloneNode(true);
    url.children[0].textContent = uri;
    task.ulist.appendChild(url);
    return true;
}

function getFileSize(bytes) {
    if (isNaN(bytes)) {
        return '??';
    }
    if (bytes < 1024) {
        return bytes;
    }
    if (bytes < 1048576) {
        return (bytes / 10.24 | 0) / 100 + 'K';
    }
    if (bytes < 1073741824) {
        return (bytes / 10485.76 | 0) / 100 + 'M';
    }
    if (bytes < 1099511627776) {
        return (bytes / 10737418.24 | 0) / 100 + 'G';
    }
    return (bytes / 10995116277.76 | 0) / 100 + 'T';
}
