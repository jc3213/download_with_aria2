let aria2RPC;
let aria2Tasks = new Map();
let aria2Queue = new Map();
let aria2Stats = new Map();
let aria2Filter = new Set(localStorage.getItem('queues')?.match(/[^;]+/g) ?? []);
let aria2Focus = new Set();
let aria2Types = {
    active: 'active',
    paused: 'waiting',
    waiting: 'waiting',
    complete: 'stopped',
    removed: 'stopped',
    error: 'stopped'
};
let aria2Proxy = '';
let aria2Delay = 'http://127.0.0.1:1230/';
let aria2Interval;

let manager = document.body.classList;
let [menuPane, filterPane, statusPane, queuePane, template] = document.body.children;
let [downBtn, purgeBtn, optionsBtn] = menuPane.children;
let [i18nEntry, verEntry, ...statEntries] = statusPane.children;
let [sessionLET, fileLET, uriLET] = template.children;

[...queuePane.children].forEach((queue) => aria2Queue.set(queue.id, queue));
statEntries.forEach((stat) => aria2Stats.set(stat.getAttribute('data-sid'), stat));
manager.add(...aria2Filter);

filterPane.addEventListener('click', (event) => {
    let id = event.target.getAttribute('data-fid');
    manager.toggle(id);
    aria2Filter.has(id) ? aria2Filter.delete(id) : aria2Filter.add(id);
    localStorage.setItem('queues', [...aria2Filter].join(';'));
});

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

purgeBtn.addEventListener('click', async (event) => {
    await aria2RPC.call({method: 'aria2.purgeDownloadResult'});
    [...aria2Queue.values()].slice(3).forEach((queue) => queue.innerHTML = '');
    let stopped = aria2Tasks.get('stopped');
    stopped.forEach((gid) => aria2Tasks.delete(gid));
    stopped.clear();
    aria2Stats.get('stopped').textContent = '0';
});

function aria2ClientSetup(scheme, jsonrpc, secret) {
    aria2RPC = new Aria2(scheme, jsonrpc, secret);
    aria2RPC.onopen = aria2ClientOpened;
    aria2RPC.onclose = aria2ClientClosed;
    aria2RPC.onmessage = aria2ClientMessage;
}

function updateManager(tasks, {downloadSpeed, uploadSpeed}) {
    tasks.forEach(taskElementUpdate);
    aria2Stats.get('download').textContent = getFileSize(downloadSpeed);
    aria2Stats.get('upload').textContent = getFileSize(uploadSpeed);
}

async function aria2ClientOpened() {
    clearInterval(aria2Interval);
    let [stats, version, active, waiting, stopped] = await aria2RPC.call({method: 'aria2.getGlobalStat'}, {method: 'aria2.getVersion'}, {method: 'aria2.tellActive'}, {method: 'aria2.tellWaiting', params: [0, 999]}, {method: 'aria2.tellStopped', params: [0, 999]});
    aria2Tasks.set('active', new Set());
    aria2Tasks.set('waiting', new Set());
    aria2Tasks.set('stopped', new Set());
    updateManager([...active.result, ...waiting.result, ...stopped.result], stats.result);
    verEntry.textContent = version.result.version;
    aria2Interval = setInterval(aria2ClientUpdate, aria2Delay);
}

async function aria2ClientUpdate() {
    let [stats, active] = await aria2RPC.call( {method: 'aria2.getGlobalStat'}, {method: 'aria2.tellActive'} );
    updateManager(active.result, stats.result);
}

const clientHandlers = {
    'aria2.onDownloadStart': (gid) => taskRemoved(gid, 'waiting'),
    'aria2.onBtDownloadComplete': (gid) => null,
    'fallback': (gid) => taskRemoved(gid, 'active')
};

function aria2ClientMessage({method, params}) {
    let { gid } = params[0];
    let handler = clientHandlers[method] ?? clientHandlers['fallback'];
    taskElementRefresh(gid);
    handler(gid);
}

function aria2ClientClosed() {
    clearInterval(aria2Interval);
    aria2Tasks.clear();
    aria2Stats.values().forEach((stat) => stat.textContent = '0');
    aria2Queue.values().forEach((queue) => queue.innerHTML = '');
    verEntry.textContent = 'N/A';
}

function taskRemoved(gid, group) {
    let tasks = aria2Tasks.get(group);
    tasks.delete(gid);
    aria2Stats.get(group).textContent = tasks.size;
}

function taskUpdated(task, gid, status) {
    let queue = aria2Queue.get(status);
    let group = aria2Types[status];
    let tasks = aria2Tasks.get(group);
    tasks.add(gid);
    aria2Stats.get(group).textContent = tasks.size;
    queue.appendChild(task);
    task.status = status;
}

async function taskElementRefresh(gid) {
    let [{ result }] = await aria2RPC.call({method: 'aria2.tellStatus', params: [gid]});
    let task = taskElementUpdate(result);
    if (aria2Focus.has(gid)) {
        task.scrollIntoView({ block: 'start', inline: 'nearest' });
        aria2Focus.delete(gid);
    }
    taskUpdated(task, gid, result.status);
}

function taskElementUpdate({gid, status, files, bittorrent, completedLength, totalLength, downloadSpeed, uploadSpeed, connections, numSeeders}) {
    let task = aria2Tasks.get(gid) ?? taskElementCreate(gid, status, bittorrent, files);
    let time = (totalLength - completedLength) / downloadSpeed;
    let days = time / 86400 | 0;
    let hours = time / 3600 - days * 24 | 0;
    let minutes = time / 60 - days * 1440 - hours * 60 | 0;
    let seconds = time - days * 86400 - hours * 3600 - minutes * 60 | 0;
    let percent = (completedLength / totalLength * 10000 | 0) / 100;
    let {path} = files[0];
    task.name.textContent ||= bittorrent?.info?.name ?? path?.slice(path.lastIndexOf('/') + 1);
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
    files.forEach(({index, length, path, completedLength}) => {
        let { name, ratio } = task[index];
        name.textContent ||= path?.slice(path.lastIndexOf('/') + 1);
        ratio.textContent = (completedLength / length * 10000 | 0) / 100;
    });
    return task;
}

async function taskRemoveHandler(task, gid, method, group) {
    await aria2RPC.call({method, params: [gid]});
    task.remove();
    taskRemoved(gid, group);
    aria2Tasks.delete(gid);
}

const taskRemoveMap = {
    'active': (task, gid) => aria2RPC.call({ method: 'aria2.forceRemove', params: [gid] }),
    'waiting': (task, gid) => taskRemoveHandler(task, gid, 'aria2.forceRemove', 'waiting'),
    'paused': (task, gid) => taskRemoveHandler(task, gid, 'aria2.forceRemove', 'waiting'),
    'complete': (task, gid) => taskRemoveHandler(task, gid, 'aria2.removeDownloadResult', 'stopped'),
    'removed': (task, gid) => taskRemoveHandler(task, gid, 'aria2.removeDownloadResult', 'stopped'),
    'error': (task, gid) => taskRemoveHandler(task, gid, 'aria2.removeDownloadResult', 'stopped'),
};

async function taskDetailHandler(gid) {
    let [ { result: files }, { result: options }] = await aria2RPC.call( {method: 'aria2.getFiles', params: [gid]}, {method: 'aria2.getOption', params: [gid]} );
    options['min-split-size'] = getFileSize(options['min-split-size']);
    options['max-download-limit'] = getFileSize(options['max-download-limit']);
    options['max-upload-limit'] = getFileSize(options['max-upload-limit']);
    return { files, options };
}

async function taskEventDetail(task, gid) {
    if (task.classList.contains('expand')) {
        task.apply.classList.add('hidden');
    } else {
        let { files, options } = await taskDetailHandler(gid);
        files.forEach(({index, selected}) => {
            task.checks.get(index).checked = selected === 'true';
        });
        task.entries.forEach((entry) => {
            let { name } = entry;
            entry.value = task.config[name] = options[name] ?? '';
        });
    }
    task.classList.toggle('expand');
}

async function taskEventRetry(task, gid) {
    let { files, options } = await taskDetailHandler(gid);
    let [{ path, uris }] = files;
    let url = new Set(uris.map(({ uri }) => uri));
    let [ , dir, out ] = path.match(/(^(?:[A-Z]:)?(?:\/[^/]*))\/([^/]+)$/) ?? [];
    options.dir = dir || null;
    options.out = out || null;
    let [{ result }] = await aria2RPC.call( {method: 'aria2.addUri', params: [url, options]}, {method: 'aria2.removeDownloadResult', params: [gid]} );
    taskElementRefresh(result);
    task.remove();
    aria2Tasks.delete(gid);
    taskRemoved(gid, 'stopped');
}

async function taskPauseHandler(task, gid, method, status) {
    await aria2RPC.call({method, params: [gid]});
    aria2Queue.get(status).appendChild(task);
    task.status = status;
}

const taskPauseMap = {
    'active': (task, gid) => taskPauseHandler(task, gid, 'aria2.forcePause', 'paused'),
    'waiting': (task, gid) => taskPauseHandler(task, gid, 'aria2.forcePause', 'paused'),
    'paused': (task, gid) => taskPauseHandler(task, gid, 'aria2.unpause', 'waiting')
};

async function taskEventApply(task, gid) {
    let { checks, config } = task;
    let selected = [];
    checks.forEach((check, index) => {
        if (check.checked) {
            selected.push(index);
        }
    });
    config['select-file'] = selected;
    aria2Focus.add(gid);
    await aria2RPC.call({ method: 'aria2.changeOption', params: [gid, config] });
    task.apply.classList.add('hidden');
}

async function taskEventAddUri(task, gid) {
    let uri = task.newuri.value;
    if (/^(http|ftp)s?:\/\/[^/]+\/.*$/.test(uri)) {
        aria2Focus.add(gid);
        await aria2RPC.call({method: 'aria2.changeUri', params: [gid, 1, [], [uri]]});
        task[uri] ??= taskUriElement(task, uri);
    }
    task.newuri.value = '';
}

function taskEventProxy(task) {
    task.config['all-proxy'] = task.proxy.value = aria2Proxy;
    task.apply.classList.remove('hidden');
}

const taskEventMap = {
    'tips_task_remove': (task, gid) => taskRemoveMap[task.status]?.(task, gid),
    'tips_task_detail': taskEventDetail,
    'tips_task_apply': taskEventApply,
    'tips_task_retry': taskEventRetry,
    'tips_task_pause': (task, gid) => taskPauseMap[task.status]?.(task, gid),
    'tips_task_adduri': taskEventAddUri,
    'tips_task_copy': (task, gid, event) => navigator.clipboard.writeText(event.target.title),
    'tips_proxy_server': taskEventProxy,
    'tips_task_fileid': (task) => task.apply.classList.remove('hidden')
};

function taskElementCreate(gid, status, bittorrent, files) {
    let task = sessionLET.cloneNode(true);
    let [name, current, time, total, network, download, upload, menu, meter, options, flist, ulist] = task.children;
    let [day, hour, minute, second] = time.children;
    let apply = menu.children[2];
    let ratio = meter.children[0];
    let newuri = ulist.children[0].children[1];
    Object.assign(task, { name, current, day, hour, minute, second, total, network, download, upload, ratio, apply, flist, ulist, newuri });
    task.entries = options.querySelectorAll('[name]');
    task.proxy = task.entries[2];
    task.config = {};
    task.checks = new Map();
    task.id = gid;
    task.classList.add(bittorrent ? 'p2p' : 'http');
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
            taskEventAddUri(task, gid);
        }
    });
    options.addEventListener('change', (event) => {
        task.config[event.target.name] = event.target.value;
        apply.classList.remove('hidden');
    });
    files.forEach(({index, length, path, selected, uris}) => {
        task[index] ??= taskFileElement(task, gid, index, selected, path, length);
        uris.forEach(({uri, status}) => {
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
    label.textContent = check.index = index;
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
    url.title = url.textContent = uri;
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
