let aria2Tasks = {};
let aria2Stats = {};
let aria2Queue = {};
let aria2Group = {
    active: 'active',
    paused: 'waiting',
    waiting: 'waiting',
    complete: 'stopped',
    removed: 'stopped',
    error: 'stopped'
};
let aria2Proxy = '';
let aria2Delay = 10000;
let aria2Interval;

let [menuPane, filterPane, systemPane, queuePane, template] = document.body.children;
let [i18nEntry, verEntry, ...statEntries] = systemPane.children;
let [sessionLET, fileLET, uriLET] = template.children;

for (let stat of statEntries) {
    aria2Stats[stat.id] = stat;
}

function taskFilters(array, callback) {
    let filters = new Set(array);
    let manager = document.body.classList;

    manager.add(...array);

    filterPane.addEventListener('click', (event) => {
        let id = event.target.id.substring(2);
        if (filters.has(id)) {
            filters.delete(id);
            manager.remove(id);
        } else {
            filters.add(id);
            manager.add(id);
        }
        callback?.([...filters]);
    });
}

async function menuPurge() {
    await aria2RPC.call({ method: 'aria2.purgeDownloadResult' });
    let { stopped } = aria2Queue;
    for (let gid of stopped) {
        aria2Tasks[gid].remove();
        delete aria2Tasks[gid];
    }
    stopped.clear();
    aria2Stats['stopped'].textContent = '0';
}

const menuEvents = {
    'popup_purge': menuPurge
};

menuPane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n');
    menuEvents[menu]?.();
});

const aria2RPC = new Aria2();
aria2RPC.onopen = () => {
    aria2RPC.call([
        { method: 'aria2.getGlobalStat' }, { method: 'aria2.getVersion' },
        { method: 'aria2.tellActive' }, { method: 'aria2.tellWaiting', params: [0, 999] }, { method: 'aria2.tellStopped', params: [0, 999] }
    ]).then(({ result: [[stats], [version], [active], [waiting], [stopped]] }) => {
        aria2Queue.active  = new Set();
        aria2Queue.waiting = new Set();
        aria2Queue.stopped = new Set();
        updateManager(stats, active);
        for (let result of waiting) {
            updateTasks(result);
        }
        for (let result of stopped) {
            updateTasks(result);
        }
        verEntry.textContent = version.version;
        aria2Interval = setInterval(() => {
            aria2RPC.call([{ method: 'aria2.getGlobalStat' }, { method: 'aria2.tellActive' }])
                .then(({ result: [[stats], [active]] }) => updateManager(stats, active));
        }, aria2Delay);
    }).catch(aria2RPC.onclose);
};
aria2RPC.onclose = () => {
    clearInterval(aria2Interval);
    aria2Tasks = {};
    verEntry.textContent = 'N/A';
    queuePane.innerHTML = '';
    for (let stat of statEntries) {
        stat.textContent = '0';
    }
};
aria2RPC.onmessage = ({ method, params }) => {
    if (method === 'aria2.onBtDownloadComplete') {
        return;
    }
    let [{ gid }] = params;
    let group = method === 'aria2.onDownloadStart' ? 'waiting' : 'active';
    reloadTasks(gid);
    removeFromQueue(gid, group);
};

function updateManager({ downloadSpeed, uploadSpeed }, active) {
    aria2Stats.download.textContent = getFileSize(downloadSpeed);
    aria2Stats.upload.textContent = getFileSize(uploadSpeed);
    for (let result of active) {
        updateTasks(result);
    }
}

function removeFromQueue(gid, group) {
    let queue = aria2Queue[group];
    queue.delete(gid);
    aria2Stats[group].textContent = queue.size;
}

function addToQueue(task, gid, status) {
    let group = aria2Group[status];
    let queue = aria2Queue[group];
    queue.add(gid);
    aria2Stats[group].textContent = queue.size;
    task.classList.replace(task.status, status);
    task.status = status;
    queuePane.appendChild(task);
}

async function reloadTasks(gid) {
    let { result } = await aria2RPC.call({ method: 'aria2.tellStatus', params: [gid] });
    let task = updateTasks(result);
    if (task.align) {
        task.scrollIntoView({ block: 'start', inline: 'nearest' });
        delete task.align;
    }
    addToQueue(task, gid, result.status);
}

function updateTasks({ gid, status, files, bittorrent, completedLength, totalLength, downloadSpeed, uploadSpeed, connections, numSeeders }) {
    let task = aria2Tasks[gid] ??= createTasks(gid, status, bittorrent, files);
    let time = (totalLength - completedLength) / downloadSpeed;
    let days = time / 86400 | 0;
    let hours = time % 86400 / 3600 | 0;
    let minutes = time % 3600 / 60 | 0;
    let seconds = time % 60 | 0;
    let percent = (completedLength / totalLength * 10000 | 0) / 100;
    let [{ path, uris }] = files;
    task.name.textContent ||= bittorrent?.info?.name ?? path?.substring(path.lastIndexOf('/') + 1) ?? uris[0]?.uri ?? gid;
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
    for (let { index, length, path, completedLength } of files) {
        let { name, ratio } = task[index];
        name.textContent ||= path?.substring(path.lastIndexOf('/') + 1);
        ratio.textContent = (completedLength / length * 10000 | 0) / 100;
    }
    return task;
}

async function removeHandler(task, gid, method, group) {
    await aria2RPC.call({ method, params: [gid] });
    removeFromQueue(gid, group);
    delete aria2Tasks[gid];
    task.remove();
}

const taskRemove = {
    'active': (task, gid) => aria2RPC.call({ method: 'aria2.forceRemove', params: [gid] }),
    'waiting': (task, gid) => removeHandler(task, gid, 'aria2.forceRemove', 'waiting'),
    'paused': (task, gid) => removeHandler(task, gid, 'aria2.forceRemove', 'waiting'),
    'complete': (task, gid) => removeHandler(task, gid, 'aria2.removeDownloadResult', 'stopped'),
    'removed': (task, gid) => removeHandler(task, gid, 'aria2.removeDownloadResult', 'stopped'),
    'error': (task, gid) => removeHandler(task, gid, 'aria2.removeDownloadResult', 'stopped'),
};

const taskPause = {
    'active': (task, gid) => aria2RPC.call({ 'method': 'aria2.forcePause', 'params': [gid] }),
    'waiting': (task, gid) => aria2RPC.call({ 'method': 'aria2.forcePause', 'params': [gid] }),
    'paused': (task, gid) => aria2RPC.call({ 'method': 'aria2.unpause', 'params': [gid] })
};

async function getDetails(gid) {
    let { result: [[files], [options]] } = await aria2RPC.call([{ method: 'aria2.getFiles', params: [gid] }, { method: 'aria2.getOption', params: [gid] }]);
    options['min-split-size'] = getFileSize(options['min-split-size']);
    options['max-download-limit'] = getFileSize(options['max-download-limit']);
    options['max-upload-limit'] = getFileSize(options['max-upload-limit']);
    return { files, options };
}

async function taskDetails(task, gid) {
    let { classList, details, checks, entries, apply } = task;
    if (classList.contains('expand')) {
        apply.classList.add('hidden');
        details.classList.remove('checked');
        classList.remove('expand');
    } else {
        let { files, options } = await getDetails(gid);
        let config = {};
        for (let { index, selected } of files) {
            checks.get(index).checked = selected === 'true';
        }
        for (let entry of entries) {
            let { name } = entry;
            entry.value = config[name] = options[name] ?? '';
        }
        task.config = config;
        details.classList.add('checked');
        classList.add('expand');
    }
}

async function taskApply(task, gid) {
    let { checks, config, apply } = task;
    let selected = [];
    for (let [index, check] of checks) {
        if (check.checked) {
            selected.push(index);
        }
    }
    config['select-file'] = selected.join(',');
    task.align = true;
    await aria2RPC.call({ method: 'aria2.changeOption', params: [gid, config] });
    apply.classList.add('hidden');
}

async function taskRetry(task, gid) {
    let { files, options } = await getDetails(gid);
    let [{ path, uris }] = files;
    let url = [];
    for (let { uri } of uris) {
        url.push(uri);
    }
    let match = path?.match(/^((?:[A-Z]:)?(?:\/[^/]+)*)\/([^/]+)$/);
    if (match) {
        options['dir'] = match[1];
        options['out'] = match[2];
    }
    let { result: [add] } = await aria2RPC.call([{ method: 'aria2.addUri', params: [url, options] }, { method: 'aria2.removeDownloadResult', params: [gid] }]);
    removeFromQueue(gid, 'stopped');
    delete aria2Tasks[gid];
    task.remove();
    if (Array.isArray(add)) {
        reloadTasks(add[0]);
    }
}

function taskProxy(task) {
    task.config['all-proxy'] = task.proxy.value = aria2Proxy;
    task.apply.classList.remove('hidden');
}

async function taskUriAdd(task, gid) {
    let url = task.newuri.value;
    task.newuri.value = '';
    let { result } = await aria2RPC.call({ method: 'aria2.changeUri', params: [gid, 1, [], [url]] });
    if (result?.[1] === 1) {
        task.align = true;
        task[url] ??= createTaskUri(task, url);
    }
}

async function taskUriRemove(task, gid, event) {
    let { files } = await getDetails(gid);
    let [{ uris }] = files;
    let url = event.target.previousElementSibling.textContent;
    let removed = [];
    for (let { uri } of uris) {
        if (uri === url) {
            removed.push(uri);
        }
    }
    let { result } = await aria2RPC.call({ method: 'aria2.changeUri', params: [gid, 1, removed, []] });
    if (result?.[0] === removed.length) {
        task.align = true;
        delete task[url];
        event.target.parentNode.remove();
    }
}

const taskEvents = {
    'tips_task_remove': (task, gid) => taskRemove[task.status]?.(task, gid),
    'tips_task_pause': (task, gid) => taskPause[task.status]?.(task, gid),
    'tips_task_detail': taskDetails,
    'tips_task_apply': taskApply,
    'tips_task_retry': taskRetry,
    'tips_proxy_server': taskProxy,
    'tips_uri_add': taskUriAdd,
    'tips_uri_copy': ($, _, event) => navigator.clipboard.writeText(event.target.textContent),
    'tips_uri_remove': taskUriRemove,
    'tips_file_index': (task) => task.apply.classList.remove('hidden')
};

function createTasks(gid, status, bittorrent, files) {
    let task = sessionLET.cloneNode(true);
    let [name, current, time, total, network, download, upload, menu, meter, options, flist, ulist] = task.children;
    let [day, hour, minute, second] = time.children;
    let [remove, details, apply] = menu.children;
    let ratio = meter.firstElementChild;
    let newuri = ulist.firstElementChild.children[1];
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
    task.details = details;
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
        taskEvents[menu]?.(task, gid, event);
    });
    task.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.code === 'KeyS') {
            event.preventDefault();
            apply.click();
        }
    });
    newuri.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            taskUriAdd(task, gid);
        }
    });
    options.addEventListener('change', (event) => {
        task.config[event.target.name] = event.target.value;
        apply.classList.remove('hidden');
    });
    for (let { index, length, path, selected, uris } of files) {
        task[index] ??= createTaskFile(task, gid, index, selected, path, length);
        for (let { uri, status } of uris) {
            task[uri] ??= createTaskUri(task, uri);
        }
    }
    addToQueue(task, gid, status);
    return task;
}

function createTaskFile(task, gid, index, selected, path, length) {
    let file = fileLET.cloneNode(true);
    let [check, label, name, size, ratio] = file.children;
    check.id = gid + '_' + index;
    check.checked = selected === 'true';
    label.textContent = index;
    label.setAttribute('for', check.id);
    name.textContent = path.substring(path.lastIndexOf('/') + 1);
    name.title = path;
    size.textContent = getFileSize(length);
    task.checks.set(index, check);
    task.flist.appendChild(file);
    return { name, ratio };
}

function createTaskUri(task, uri) {
    let url = uriLET.cloneNode(true);
    url.firstElementChild.textContent = uri;
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
