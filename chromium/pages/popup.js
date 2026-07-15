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
    let manager = document.body.classList;

    manager.add(...array);

    filterPane.addEventListener('click', (event) => {
        let id = event.target.id.substring(2);
        let index = array.indexOf(id);

        if (index === -1) {
            array.push(id);
            manager.add(id);
        } else {
            array.splice(index, 1);
            manager.remove(id);
        }

        if (callback) {
            callback(array);
        }
    });
}

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
    queue.add(gid);
    aria2Stats[group].textContent = queue.size;

    task.draggable = status === 'waiting';
    task.classList.replace(task.status, status);
    task.status = status;
}

async function reloadTasks(gid) {
    let response = await aria2.call('aria2.tellStatus', [gid]);
    let result = response.result;
    let task = updateTasks(result);

    if (task.align) {
        task.scrollIntoView({ block: 'start', inline: 'nearest' });
        delete task.align;
    }

    let newsts = result.status;
    addToQueue(task, gid, newsts);

    if (newsts === 'active') {
        queuePane.appendChild(task);
    }
}

function updateTasks(result) {
    let gid = result.gid;
    let bittorrent = result.bittorrent;
    let files = result.files;
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

    let task = aria2Tasks[gid];

    if (!task) {
        task = createTasks(gid, result.status, bittorrent, files);
    } else {
        for (let i = 0, l = files.length; i < l; i++) {
            let file = files[i];
            let fileEl = task[file.index];

            if (fileEl.placeholder) {
                let path = file.path;

                if (path) {
                    fileEl.name.textContent = path.substring(path.lastIndexOf('/') + 1);
                    delete fileEl.placeholder;
                }
            }

            fileEl.ratio.textContent = (file.completedLength / file.length * 10000 | 0) / 100;
        }
    }

    if (task.placeholder) {
        let path = files[0].path;

        if (path) {
            task.name.textContent = path.substring(path.lastIndexOf('/') + 1);
            delete task.placeholder;
        }
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

    return task;
}

function createTasks(gid, status, bittorrent, files) {
    let task = sessionLET.cloneNode(true);
    let tree = task.children;

    let times = tree[2].children;
    let menus = tree[7].children;
    let options = tree[9];
    let newuri = tree[11].firstElementChild.children[1];
    let fileList = tree[10];
    let uriList = tree[11];

    let entries = options.querySelectorAll('[name]');
    let proxy = entries[2];
    let detail = menus[1];
    let apply = menus[2];

    let file = files[0];
    let path = file.path;
    let config = {};
    let checks = [];

    task.id = gid;
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
    task.ratio = tree[8].firstElementChild;

    if (bittorrent) {
        task.classList.add(status, 'p2p');
        task.name.textContent = bittorrent.info ? bittorrent.info.name : path;
    } else {
        task.classList.add(status, 'http');

        if (path) {
            task.name.textContent = path.substring(path.lastIndexOf('/') + 1);
        } else {
            task.name.textContent = file.uris[0].uri;
            task.placeholder = true;
        }
    }

    task.addEventListener('click', (event) => {
        let menu = event.target.getAttribute('i18n-tips');
        
        if (!menu) {
            return;
        }

        if (menu === 'tips_task_remove') {
            taskRemove(task, gid);
            return;
        }

        if (menu === 'tips_task_pause') {
            taskPause(task, gid);
            return;
        }

        if (menu === 'tips_task_detail') {
            taskDetails(task, gid, config, checks, entries, detail, apply);
            return;
        }

        if (menu === 'tips_task_apply') {
            taskApply(task, gid, config, checks);
            apply.classList.add('hidden');
            return;
        }

        if (menu === 'tips_task_retry') {
            taskRetry(task, gid);
            return;
        }

        if (menu === 'tips_proxy_server') {
            proxy.value = aria2Proxy;
            config['all-proxy'] = aria2Proxy;
            apply.classList.remove('hidden');
            return;
        }

        if (menu === 'tips_uri_add') {
            taskUriAdd(task, gid, newuri);
            return;
        }

        if (menu === 'tips_uri_copy') {
            let url = event.target.textContent;
            navigator.clipboard.writeText(url);
            return;
        }

        if (menu === 'tips_uri_remove') {
            taskUriRemove(task, gid, event);
            return;
        }

        if (menu === 'tips_file_index') {
            apply.classList.remove('hidden');
            return;
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
            taskUriAdd(task, gid, newuri);
        }
    });

    options.addEventListener('change', (event) => {
        config[event.target.name] = event.target.value;
        apply.classList.remove('hidden');
    });

    for (let i = 0, l = files.length; i < l; i++) {
        let file = files[i];
        let index = file.index;

        if (!task[index]) {
            createTaskFile(task, gid, index, file, checks, fileList, uriList);
        }
    }

    addToQueue(task, gid, status);
    queuePane.appendChild(task);
    aria2Tasks[gid] = task;
    return task;
}

function createTaskFile(task, gid, index, file, checks, fileList, uriList) {
    let fileEl = fileLET.cloneNode(true);
    let tree = fileEl.children;
    let check = tree[0];
    let label = tree[1];
    let name = tree[2];
    let size = tree[3];
    let ratio = tree[4];

    let id = gid + '-' + index;
    let path = file.path;
    let uris = file.uris;

    if (path) {
        name.textContent = path.substring(path.lastIndexOf('/') + 1);
        name.title = path;
    } else {
        fileEl.placeholder = true;
    }

    for (let i = 0, l = uris.length; i < l; i++) {
        let uri = uris[i].uri;

        if (task[uri]) {
            continue;
        }

        let uriEl = uriLET.cloneNode(true);
        uriEl.firstElementChild.textContent = uri;
        uriList.appendChild(uriEl);
        task[uri] = uriEl;
    }

    check.id = id;
    check.checked = file.selected === 'true';
    checks[index] = check;
    label.textContent = index;
    label.setAttribute('for', id);
    size.textContent = getFileSize(file.length);
    ratio.textContent = (file.completedLength / file.length * 10000 | 0) / 100;

    fileEl.name = name;
    fileEl.ratio = ratio;
    fileList.appendChild(fileEl);
    task[index] = fileEl;
}

const taskRemoveMap = {
    'active': { method: 'aria2.forceRemove' },
    'waiting': { method: 'aria2.forceRemove', queue: 'waiting' },
    'paused': { method: 'aria2.forceRemove', queue: 'waiting' },
    'complete': { method: 'aria2.removeDownloadResult', queue: 'stopped' },
    'removed': { method: 'aria2.removeDownloadResult', queue: 'stopped' },
    'error': { method: 'aria2.removeDownloadResult', queue: 'stopped' }
}

async function taskRemove(task, gid) {
    let action = taskRemoveMap[task.status];
    let method = action.method;
    let queue = action.queue;

    await aria2.call(method, [gid]);

    if (queue) {
        removeFromQueue(gid, queue);
        delete aria2Tasks[gid];
        task.remove();
    }
}

const taskPauseMap = {
    'active': { method: 'aria2.forcePause', status: 'paused' },
    'waiting': { method: 'aria2.pause', status: 'paused' },
    'paused': { method: 'aria2.unpause', status: 'waiting' }
};

async function taskPause(task, gid) {
    let oldsts = task.status;
    let action = taskPauseMap[oldsts];

    if (!action) {
        return;
    }

    let method = action.method;
    let newsts = action.status;
    task.classList.replace(oldsts, newsts);
    task.status = newsts;
    await aria2.call(method, [gid]);
}

async function getDetails(gid) {
    let response = await aria2.multicall([
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

async function taskDetails(task, gid, config, checks, entries, detail, apply) {
    let classList = task.classList;
    let detailList = detail.classList;

    if (classList.contains('expand')) {
        apply.classList.add('hidden');
        detailList.remove('checked');
        classList.remove('expand');
    } else {
        let result = await getDetails(gid);
        let files = result.files;
        let options = result.options;

        for (let i = 0, l = files.length; i < l; i++) {
            let file = files[i];
            checks[file.index].checked = file.selected === 'true';
        }

        for (let i = 0, l = entries.length; i < l; i++) {
            let entry = entries[i];
            let name = entry.name;
            let value = options[name];

            if (value) {
                entry.value = value;
                config[name] = value;
            }
        }

        task.config = config;
        detailList.add('checked');
        classList.add('expand');
    }
}

async function taskApply(task, gid, config, checks) {
    let selected = [];

    for (let i = 1, l = checks.length; i < l; i++) {
        let check = checks[i];;

        if (check.checked) {
            selected.push(i);
        }
    }

    config['select-file'] = selected.join(',');
    task.align = true;
    await aria2.call('aria2.changeOption', [gid, config]);
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

    let response = await aria2.multicall([
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

async function taskUriAdd(task, gid, entry) {
    let url = entry.value;
    entry.value = '';

    let response = await aria2.call('aria2.changeUri', [gid, 1, [], [url]]);

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

    let response = await aria2.call('aria2.changeUri', [gid, 1, removed, []]);

    if (response.result && response.result[0] === removed.length) {
        task.align = true;
        delete task[url];
        event.target.parentNode.remove();
    }
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

    let gid = aria2Drag.id;
    let pos;
    let insert;

    let status = target.status;
    let waiting = Array.from(queuePane.querySelectorAll(':scope > .waiting'));
    let index = waiting.indexOf(aria2Drag);

    if (status === 'waiting') {
        pos = waiting.indexOf(target);

        if (pos > index) {
            insert = target.nextElementSibling;
        } else {
            insert = target;
        }
    } else if (status === 'active') {
        pos = 0;
        insert = waiting[0];
    } else {
        pos = waiting.length - 1;
    }

    await aria2.call('aria2.changePosition', [gid, pos, 'POS_SET']);
    queuePane.insertBefore(aria2Drag, insert);
});

const aria2 = new Aria2();

aria2.onopen = jsonrpcStart;

aria2.onclose = jsonrpcError;

aria2.onmessage = (message) => {
    let method = message.method;

    if (method === 'aria2.onBtDownloadComplete') {
        return;
    }

    let gid = message.params[0].gid;
    let group = method === 'aria2.onDownloadStart' ? 'waiting' : 'active';
    removeFromQueue(gid, group);
    reloadTasks(gid);
};

function jsonrpcStart() {
    aria2.multicall([
        { methodName: 'aria2.getGlobalStat' },
        { methodName: 'aria2.getVersion' },
        { methodName: 'aria2.tellActive' },
        { methodName: 'aria2.tellWaiting', params: [0, 999] },
        { methodName: 'aria2.tellStopped', params: [0, 999] }
    ]).then((response) => {
        let result = response.result;
        let global = result[0][0];
        let version = result[1][0];
        let active = result[2][0];
        let waiting = result[3][0];
        let stopped = result[4][0];

        aria2Queue.active  = new Set();
        aria2Queue.waiting = new Set();
        aria2Queue.stopped = new Set();

        verEntry.textContent = version.version;
        updateManager(global, active);

        for (let i = 0, l = waiting.length; i < l; i++) {
            updateTasks(waiting[i]);
        }

        for (let i = 0, l = stopped.length; i < l; i++) {
            updateTasks(stopped[i]);
        }

        aria2Interval = setInterval(() => {
            aria2.multicall([
                { methodName: 'aria2.getGlobalStat' },
                { methodName: 'aria2.tellActive' }
            ]).then((response) => {
                let result = response.result;
                let global = result[0][0];
                let active = result[1][0];
                updateManager(global, active);
            });
        }, aria2Delay);
    }).catch(jsonrpcError);
}

function jsonrpcError() {
    clearInterval(aria2Interval);
    aria2Tasks = {};

    verEntry.textContent = 'N/A';
    queuePane.innerHTML = '';

    for (let i = 2, l = systemTree.length; i < l; i++) {
        systemTree[i].textContent = '0';
    }
}
