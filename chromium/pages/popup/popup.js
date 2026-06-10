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
let aria2Drag = null;

let mainTree = document.body.children;
let menuPane = mainTree[0];
let filterPane = mainTree[1];
let systemPane = mainTree[2];
let queuePane = mainTree[3];
let template = mainTree[4];

let systemTree = systemPane.children;
let i18nEntry = systemTree[0];
let verEntry = systemTree[1];
for (let i = 2, l = systemTree.length; i < l; i++) {
    let stat = systemTree[i];
    aria2Stats[stat.id] = stat;
}

let templateTree = template.children;
let sessionLET = templateTree[0];
let fileLET = templateTree[1];
let uriLET = templateTree[2];

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
        if (callback) {
            callback([...filters]);
        }
    });
}

async function menuPurge() {
    await aria2RPC.call('aria2.purgeDownloadResult');
    for (let gid of aria2Queue.stopped) {
        aria2Tasks[gid].remove();
        delete aria2Tasks[gid];
    }
    aria2Queue.stopped = new Set();
    aria2Stats.stopped.textContent = '0';
}

const menuEvents = {
    'popup_purge': menuPurge
};

menuPane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n');
    let handler = menuEvents[menu];
    if (handler) {
        handler();
    }
});

const aria2RPC = new Aria2();
aria2RPC.onopen = () => {
    aria2RPC.multicall([
        { methodName: 'aria2.getGlobalStat' },
        { methodName: 'aria2.getVersion' },
        { methodName: 'aria2.tellActive' },
        { methodName: 'aria2.tellWaiting', params: [0, 999] },
        { methodName: 'aria2.tellStopped', params: [0, 999] }
    ]).then((response) => {
        let result = response.result;
        let waiting = result[3][0];
        let stopped = result[4][0];
        aria2Queue.active  = new Set();
        aria2Queue.waiting = new Set();
        aria2Queue.stopped = new Set();
        verEntry.textContent = result[1][0].version;
        updateManager(result[0][0], result[2][0]);
        for (let i = 0, l = waiting.length; i < l; i++) {
            updateTasks(waiting[i]);
        }
        for (let i = 0, l = stopped.length; i < l; i++) {
            updateTasks(stopped[i]);
        }
        aria2Interval = setInterval(() => {
            aria2RPC.multicall([
                { methodName: 'aria2.getGlobalStat' },
                { methodName: 'aria2.tellActive' }
            ]).then((response) => {
                let result = response.result;
                updateManager(result[0][0], result[1][0]);
            });
        }, aria2Delay);
    }).catch(aria2RPC.onclose);
};
aria2RPC.onclose = () => {
    clearInterval(aria2Interval);
    aria2Tasks = {};
    verEntry.textContent = 'N/A';
    queuePane.innerHTML = '';
    for (let i = 2, l = systemTree.length; i < l; i++) {
        systemTree[i].textContent = '0';
    }
};
aria2RPC.onmessage = (message) => {
    let method = message.method;
    if (method === 'aria2.onBtDownloadComplete') {
        return;
    }
    let gid = message.params[0].gid;
    let group = method === 'aria2.onDownloadStart' ? 'waiting' : 'active';
    reloadTasks(gid);
    removeFromQueue(gid, group);
};

function updateManager(stats, active) {
    aria2Stats.download.textContent = getFileSize(stats.downloadSpeed);
    aria2Stats.upload.textContent = getFileSize(stats.uploadSpeed);
    for (let i = 0, l = active.length; i < l; i++) {
        updateTasks(active[i]);
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
    aria2Stats[group].textContent = queue.size;
    task.classList.replace(task.status, status);
    task.status = status;
    task.draggable = group === 'waiting';
    queue.add(gid);
    queuePane.appendChild(task);
}

async function reloadTasks(gid) {
    let response = await aria2RPC.call('aria2.tellStatus', [gid]);
    let result = response.result;
    let task = updateTasks(result);
    if (task.align) {
        task.scrollIntoView({ block: 'start', inline: 'nearest' });
        delete task.align;
    }
    addToQueue(task, gid, result.status);
}

function updateTasks(result) {
    let gid = result.gid;
    let bittorrent = result.bittorrent;
    let files = result.files;
    let task = aria2Tasks[gid];
    if (!task) {
        task = createTasks(gid, result.status, bittorrent, files);
        aria2Tasks[gid] = task;
    }
    let completedLength = result.completedLength;
    let totalLength = result.totalLength;
    let downloadSpeed = result.downloadSpeed;
    let connections = result.connections;
    let time = (totalLength - completedLength) / downloadSpeed;
    let days = time / 86400 | 0;
    let hours = time % 86400 / 3600 | 0;
    let minutes = time % 3600 / 60 | 0;
    let seconds = time % 60 | 0;
    let percent = (completedLength / totalLength * 10000 | 0) / 100;
    let file = files[0];
    let path = file.path;
    let uris = file.uris;
    if (!task.name.textContent) {
        task.name.textContent = bittorrent?.info?.name || path?.substring(path.lastIndexOf('/') + 1) || uris[0]?.uri || gid;
    }
    task.current.textContent = getFileSize(completedLength);
    task.total.textContent = getFileSize(totalLength);
    task.day.textContent = days || '';
    task.hour.textContent = hours || '';
    task.minute.textContent = minutes || '';
    task.second.textContent = seconds || '';
    task.network.textContent = bittorrent ? connections + '(' + result.numSeeders + ')' : connections;
    task.download.textContent = getFileSize(downloadSpeed);
    task.upload.textContent = getFileSize(result.uploadSpeed);
    task.ratio.textContent = percent;
    task.ratio.style.width = percent + '%';
    for (let i = 0, l = files.length; i < l; i++) {
        let file = files[i];
        let path = file.path;
        let el = task[file.index];
        if (!el.name.textContent && path) {
            el.name.textContent = path.substring(path.lastIndexOf('/') + 1);
        }
        el.ratio.textContent = (file.completedLength / file.length * 10000 | 0) / 100;
    }
    return task;
}

async function removeHandler(task, gid, method, group) {
    await aria2RPC.call(method, [gid]);
    removeFromQueue(gid, group);
    delete aria2Tasks[gid];
    task.remove();
}

const taskRemove = {
    'active': (task, gid) => aria2RPC.call('aria2.forceRemove', [gid]),
    'waiting': (task, gid) => removeHandler(task, gid, 'aria2.forceRemove', 'waiting'),
    'paused': (task, gid) => removeHandler(task, gid, 'aria2.forceRemove', 'waiting'),
    'complete': (task, gid) => removeHandler(task, gid, 'aria2.removeDownloadResult', 'stopped'),
    'removed': (task, gid) => removeHandler(task, gid, 'aria2.removeDownloadResult', 'stopped'),
    'error': (task, gid) => removeHandler(task, gid, 'aria2.removeDownloadResult', 'stopped'),
};

const taskPause = {
    'active': (task, gid) => aria2RPC.call('aria2.forcePause', [gid]),
    'waiting': (task, gid) => aria2RPC.call('aria2.forcePause', [gid]),
    'paused': (task, gid) => aria2RPC.call('aria2.unpause', [gid])
};

async function getDetails(gid) {
    let response = await aria2RPC.multicall([
        { methodName: 'aria2.getFiles', params: [gid] },
        { methodName: 'aria2.getOption', params: [gid] }
    ]);
    let result = response.result;
    let files = result[0][0];
    let options = result[1][0];
    options['min-split-size'] = getFileSize(options['min-split-size']);
    options['max-download-limit'] = getFileSize(options['max-download-limit']);
    options['max-upload-limit'] = getFileSize(options['max-upload-limit']);
    return { files, options };
}

async function taskDetails(task, gid) {
    let classes = task.classList;
    let details = task.details;
    if (classes.contains('expand')) {
        task.apply.classList.add('hidden');
        details.classList.remove('checked');
        classes.remove('expand');
    } else {
        let result = await getDetails(gid);
        let config = {};
        let files = result.files;
        let options = result.options;
        let checks = task.checks;
        let entries = task.entries;
        for (let i = 0, l = files.length; i < l; i++) {
            let file = files[i];
            checks.get(file.index).checked = file.selected === 'true';
        }
        for (let i = 0, l = entries.length; i < l; i++) {
            let entry = entries[i];
            let name = entry.name;
            entry.value = config[name] = options[name] || '';
        }
        task.config = config;
        details.classList.add('checked');
        classes.add('expand');
    }
}

async function taskApply(task, gid) {
    let checks = task.checks;
    let config = task.config;
    let selected = [];
    for (let entries of checks) {
        let check = entries[1];
        if (check.checked) {
            selected.push(entries[0]);
        }
    }
    config['select-file'] = selected.join(',');
    task.align = true;
    await aria2RPC.call('aria2.changeOption', [gid, config]);
    task.apply.classList.add('hidden');
}

async function taskRetry(task, gid) {
    let result = await getDetails(gid);
    let options = result.options;
    let file = result.files[0];
    let path = file.path;
    let uris = file.uris;
    let url = [];
    for (let i = 0, l = uris.length; i < l; i++) {
        url.push(uris[i].uri);
    }
    if (path) {
        let match = path.match(/^((?:[A-Z]:)?(?:\/[^/]+)*)\/([^/]+)$/);
        if (match) {
            options['dir'] = match[1];
            options['out'] = match[2];
        }
    }
    let response = await aria2RPC.multicall([
        { methodName: 'aria2.addUri', params: [url, options] },
        { methodName: 'aria2.removeDownloadResult', params: [gid] }
    ]);
    let added = response.result[0][0];
    removeFromQueue(gid, 'stopped');
    delete aria2Tasks[gid];
    task.remove();
    if (Array.isArray(added)) {
        reloadTasks(added[0]);
    }
}

function taskProxy(task) {
    task.config['all-proxy'] = task.proxy.value = aria2Proxy;
    task.apply.classList.remove('hidden');
}

async function taskUriAdd(task, gid) {
    let url = task.newuri.value;
    task.newuri.value = '';
    let response = await aria2RPC.call('aria2.changeUri', [gid, 1, [], [url]]);
    if (response.result && response.result[1] === 1) {
        task.align = true;
        task[url] = createTaskUri(task, url);
    }
}

async function taskUriRemove(task, gid, event) {
    let result = await getDetails(gid);
    let uris = result.files[0].uris;
    let url = event.target.previousElementSibling.textContent;
    let removed = [];
    for (let i = 0, l = uris.length; i < l; i++) {
        if (uris[i].uri === url) {
            removed.push(url);
        }
    }
    let response = await aria2RPC.call('aria2.changeUri', [gid, 1, removed, []]);
    if (response.result && response.result[0] === removed.length) {
        task.align = true;
        delete task[url];
        event.target.parentNode.remove();
    }
}

const taskEvents = {
    'tips_task_remove'(task, gid) {
        let handler = taskRemove[task.status];
        if (handler) {
            handler(task, gid);
        }
    },
    'tips_task_pause'(task, gid) {
        let handler = taskPause[task.status];
        if (handler) {
            handler(task, gid);
        }
    },
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
    let tree = task.children;
    let times = tree[2].children;
    let menus = tree[7].children;
    let options = tree[9];
    let newuri = tree[11].firstElementChild.children[1];
    task.name = tree[0];
    task.current = tree[1];
    task.day = times[0];
    task.hour = times[1];
    task.minute = times[2];
    task.second = times[3];
    task.total = tree[3];
    task.network = tree[4];
    task.download = tree[5];
    task.upload = tree[6];
    task.details = menus[1];
    task.apply = menus[2];
    task.ratio = tree[8].firstElementChild;
    task.entries = options.querySelectorAll('[name]');
    task.flist = tree[10];
    task.ulist = tree[11];
    task.newuri = newuri;
    task.proxy = task.entries[2];
    task.checks = new Map();
    task.id = gid;
    task.classList.add(status, bittorrent ? 'p2p' : 'http');
    task.addEventListener('click', (event) => {
        let menu = event.target.getAttribute('i18n-tips');
        let handler = taskEvents[menu];
        if (handler) {
            handler(task, gid, event);
        }
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
    for (let i = 0, l = files.length; i < l; i++) {
        let file = files[i];
        let uris = file.uris;
        let index = file.index;
        if (!task[index]) {
            task[index] = createTaskFile(task, gid, index, file.selected, file.path, file.length);
        }
        for (let j = 0, m = uris.length; j < m; j++) {
            let uri = uris[j].uri;
            if (!task[uri]) {
                task[uri] = createTaskUri(task, uri);
            }
        }
    }
    addToQueue(task, gid, status);
    return task;
}

function createTaskFile(task, gid, index, selected, path, length) {
    let file = fileLET.cloneNode(true);
    let tree = file.children;
    let check = tree[0];
    let label = tree[1];
    let name = tree[2];
    let size = tree[3];
    let ratio = tree[4];
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

queuePane.addEventListener("dragstart", (event) => {
    aria2Drag = event.target;
});

queuePane.addEventListener("dragover", (event) => {
    event.preventDefault();
});

queuePane.addEventListener('drop', async (event) => {
    if (!aria2Drag) {
        return;
    }
    event.preventDefault();
    let target = event.target.closest(".session");
    if (!target || aria2Drag === target) {
        return;
    }
    let id = aria2Drag.id;
    let group = aria2Group[target.status];
    let waiting = [...aria2Queue.waiting];
    let index = waiting.indexOf(id);
    let pos;
    if (group === 'waiting') {
        pos = waiting.indexOf(target.id);
        if (pos > index) {
            target = target.nextElementSibling;
        }
    } else if (group === 'active') {
        pos = 0;
        target = queuePane.querySelector('.waiting, .paused');
    } else if (group === 'stopped') {
        pos = waiting.length - 1;
        target = null;
    }
    aria2RPC.call('aria2.changePosition', [id, pos, 'POS_SET'])
        .then(() => {
            waiting.splice(index, 1);
            waiting.splice(pos, 0, id);
            queuePane.insertBefore(aria2Drag, target);
            aria2Queue['waiting'] = new Set(waiting);
        });
});
