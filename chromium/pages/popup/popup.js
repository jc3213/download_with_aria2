let aria2RPC;
let aria2Tasks = { active: {}, waiting: {}, stopped: {} };
let aria2Queue = {};
let aria2Stats = {};
let aria2Filter = new Set(localStorage['queues']?.match(/[^;]+/g) ?? []);
let aria2Proxy;
let aria2Delay;
let aria2Interval;

let manager = document.body.classList;
let [menuPane, filterPane, queuePane, template] = document.body.children;
let [downBtn, purgeBtn, optionsBtn, ...statEntries] = menuPane.children;
let [sessionLET, fileLET, uriLET] = template.children;

[...queuePane.children].forEach((queue) => aria2Queue[queue.id] = queue);
statEntries.forEach((stat) => aria2Stats[stat.dataset.sid] = stat);

manager.add(...aria2Filter);

filterPane.addEventListener('click', (event) => {
    let id = event.target.dataset.fid;
    manager.toggle(id);
    aria2Filter.has(id) ? aria2Filter.delete(id) : aria2Filter.add(id);
    localStorage['queues'] = [...aria2Filter].join(';');
});

const shortcutHandlers = {
    'r': purgeBtn,
    'd': downBtn,
    's': optionsBtn
};

document.addEventListener('keydown', (event) => {
    let handler = shortcutHandlers[event.key];
    if (event.ctrlKey && handler) {
        event.preventDefault();
        handler.click();
    }
});

purgeBtn.addEventListener('click', async (event) => {
    let {active, waiting} = aria2Tasks;
    await aria2RPC.call({method: 'aria2.purgeDownloadResult'});
    aria2Queue.complete.innerHTML = aria2Queue.removed.innerHTML = aria2Queue.error.innerHTML = '';
    aria2Stats.stopped.textContent = '0';
    aria2Tasks = { ...active, ...waiting, active, waiting, stopped: {} };
});

async function aria2ClientOpened() {
    clearInterval(aria2Interval);
    let [global, active, waiting, stopped] = await aria2RPC.call( {method: 'aria2.getGlobalStat'}, {method: 'aria2.tellActive'}, {method: 'aria2.tellWaiting', params: [0, 999]}, {method: 'aria2.tellStopped', params: [0, 999]} );
    [...active.result, ...waiting.result, ...stopped.result].forEach(taskElementUpdate);
    aria2Stats.download.textContent = getFileSize(global.result.downloadSpeed);
    aria2Stats.upload.textContent = getFileSize(global.result.uploadSpeed);
    aria2Interval = setInterval(aria2ClientUpdate, aria2Delay);
}

function aria2ClientClosed() {
    clearInterval(aria2Interval);
    aria2Tasks = { active: {}, waiting: {}, stopped: {} };
    aria2Stats.active.textContent = aria2Stats.waiting.textContent = aria2Stats.stopped.textContent = aria2Stats.download.textContent = aria2Stats.upload.textContent = '0';
    aria2Queue.active.innerHTML = aria2Queue.waiting.innerHTML = aria2Queue.paused.innerHTML = aria2Queue.complete.innerHTML = aria2Queue.removed.innerHTML = aria2Queue.error.innerHTML = '';
}

const clientHandlers = {
    'aria2.onBtDownloadComplete': () => {},
    'aria2.onDownloadStart': (gid) => {
        taskElementRefresh(gid);
        if (aria2Tasks.waiting[gid]) {
            delete aria2Tasks.waiting[gid];
            aria2Stats.waiting.textContent --;
        }
    },
    'default': (gid) => {
        taskElementRefresh(gid);
        if (aria2Tasks.active[gid]) {
            delete aria2Tasks.active[gid];
            aria2Stats.active.textContent --;
        }
    }
};

function aria2ClientMessage({method, params}) {
    let handler = clientHandlers[method] ?? clientHandlers['default'];
    handler(params[0].gid);
}

async function aria2ClientUpdate() {
    let [global, active] = await aria2RPC.call( {method: 'aria2.getGlobalStat'}, {method: 'aria2.tellActive'} );
    active.result.forEach(taskElementUpdate);
    aria2Stats.download.textContent = getFileSize(global.result.downloadSpeed);
    aria2Stats.upload.textContent = getFileSize(global.result.uploadSpeed);
}

function taskQueueChange(task, gid, status) {
    let queue = aria2Queue[status];
    let type = queue.dataset.tid;
    if (!aria2Tasks[type][gid]) {
        aria2Tasks[type][gid] = task;
        aria2Stats[type].textContent ++;
    }
    queue.appendChild(task);
    task.status = status;
}

async function taskElementRefresh(gid) {
    let [session] = await aria2RPC.call({method: 'aria2.tellStatus', params: [gid]});
    let task = taskElementUpdate(session.result);
    taskQueueChange(task, gid, session.result.status);
}

function taskElementUpdate({gid, status, files, bittorrent, completedLength, totalLength, downloadSpeed, uploadSpeed, connections, numSeeders}) {
    let task = aria2Tasks[gid] ??= taskElementCreate(gid, status, bittorrent, files);
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
    task.network.textContent = bittorrent ? numSeeders + '(' + connections + ')' : connections;
    task.download.textContent = getFileSize(downloadSpeed);
    task.upload.textContent = getFileSize(uploadSpeed);
    task.ratio.textContent = percent;
    task.ratio.style.width = percent + '%';
    files.forEach(({index, length, path, completedLength}) => {
        let {name, ratio} = task[index];
        name.textContent ||= path?.slice(path.lastIndexOf('/') + 1);
        ratio.textContent = (completedLength / length * 10000 | 0) / 100;
    });
    return task;
}

const taskEventHandlers = {
    'tips_task_remove': taskEventRemove,
    'tips_task_detail': taskEventDetail,
    'tips_task_retry': taskEventRetry,
    'tips_task_pause': taskEventPause,
    'tips_proxy_server': taskEventProxy,
    'tips_select_file': taskEventSelect,
    'tips_task_adduri': taskEventAddUri,
    'tips_task_copy': (task, gid, event) => navigator.clipboard.writeText(event.target.title),
    'tips_task_fileid': (task) => task.change.style.display = 'block'
};

const removeHandlers = {
    'active': { method: 'aria2.forceRemove' },
    'waiting': { method: 'aria2.forceRemove', removed: 'waiting'},
    'paused': { method: 'aria2.forceRemove', removed: 'waiting'},
    'complete': { method: 'aria2.removeDownloadResult', removed: 'stopped'},
    'removed': { method: 'aria2.removeDownloadResult', removed: 'stopped'},
    'error': { method: 'aria2.removeDownloadResult', removed: 'stopped'}
};

async function taskEventRemove(task, gid) {
    let {method, removed} = removeHandlers[task.status];
    await aria2RPC.call({method, params: [gid]});
    if (removed) {
        task.remove();
        delete aria2Tasks[gid];
        delete aria2Tasks[removed][gid];
        aria2Stats[removed].textContent --;
    }
}

async function taskEventDetail(task, gid) {
    if (task.opened) {
        task.opened = false;
        task.change.style.display = '';
    } else {
        task.opened = true;
        task.config ??= await taskEventDetailGetter(gid);
        task.entries.forEach((entry) => {
            entry.value = task.config[entry.name] ?? '';
        });
        task.checks.forEach((check, index) => {
            check.checked = task.chosen[index + 1];
        });
    }
    task.classList.toggle('expand');
}

async function taskEventDetailGetter(gid) {
    let [{result}] = await aria2RPC.call( {method: 'aria2.getOption', params: [gid]} );
    result['min-split-size'] = getFileSize(result['min-split-size']);
    result['max-download-limit'] = getFileSize(result['max-download-limit']);
    result['max-upload-limit'] = getFileSize(result['max-upload-limit']);
    return result;
}

async function taskEventRetry(task, gid) {
    let [files, options] = await aria2RPC.call( {method: 'aria2.getFiles', params: [gid]}, {method: 'aria2.getOption', params: [gid]} );
    let {uris, path} = files.result[0];
    let url = [...new Set(uris.map(({uri}) => uri))];
    if (path) {
        let ni = path.lastIndexOf('/');
        options.result['dir'] = path.slice(0, ni);
        options.result['out'] = path.slice(ni + 1);
    }
    let [added] = await aria2RPC.call( {method: 'aria2.addUri', params: [url, options.result]}, {method: 'aria2.removeDownloadResult', params: [gid]} );
    taskElementRefresh(added.result);
    task.remove();
    delete aria2Tasks[gid];
    delete aria2Tasks.stopped[gid];
    aria2Stats.stopped.textContent --;
}

const pauseHandlers = {
    'active': {method: 'aria2.forcePause', queue: 'paused'},
    'waiting': {method: 'aria2.forcePause', queue: 'paused'},
    'paused': {method: 'aria2.unpause', queue: 'waiting'}
};

async function taskEventPause(task, gid) {
    let {method, queue} = pauseHandlers[task.status] ?? {};
    if (method) {
        await aria2RPC.call({method, params: [gid]});
        aria2Queue[queue].appendChild(task);
        task.status = queue;
    }
}

async function taskEventProxy(task, gid) {
    task.config['all-proxy'] = aria2Proxy;
    await aria2RPC.call({method: 'aria2.changeOption', params: [gid, {'all-proxy': aria2Proxy}]});
    task.proxy.value = aria2Proxy;
}

async function taskEventSelect(task, gid) {
    let selected = [];
    task.checks.forEach((check) => {
        let label = check.labels[0].textContent;
        task.chosen[label] = check.checked;
        if (check.checked) {
            selected.push(label);
        }
    });
    await aria2RPC.call({ method: 'aria2.changeOption', params: [gid, {'select-file': selected.join()}] });
    task.change.style.display = '';
}

async function taskEventAddUri(task, gid) {
    let uri = task.newuri.value;
    if (/^(http|ftp)s?:\/\/[^/]+\/.*$/.test(uri)) {
        await aria2RPC.call({method: 'aria2.changeUri', params: [gid, 1, [], [uri]]});
        task[uri] ??= taskUriElement(task, uri);
    }
    task.newuri.value = '';
}

function taskElementCreate(gid, status, bittorrent, files) {
    let task = sessionLET.cloneNode(true);
    let [name, current, time, total, network, download, upload, menu, meter, options, flist, ulist] = task.children;
    let [day, hour, minute, second] = time.children;
    let ratio = meter.children[0];
    let change = flist.children[0].children[1];
    let newuri = ulist.children[0].children[1];
    Object.assign(task, {name, current, day, hour, minute, second, total, network, download, upload, ratio, flist, ulist, newuri, change, chosen: {}, checks: []});
    task.entries = options.querySelectorAll('[name]');
    task.proxy = task.entries[2];
    task.id = gid;
    task.classList.add(bittorrent ? 'p2p' : 'http');
    task.addEventListener('click', (event) => {
        let handler = taskEventHandlers[event.target.getAttribute('i18n-tips')];
        if (handler) {
            handler(task, gid, event);
        }
    });
    newuri.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            taskEventAddUri(task, gid);
        }
    });
    options.addEventListener('change', (event) => {
        task.config[event.target.name] = event.target.value;
        aria2RPC.call({ method: 'aria2.changeOption', params: [gid, task.config] });
    });
    files.forEach(({index, length, path, selected, uris}) => {
        task[index] ??= taskFileElement(task, gid, index, selected, path, length);
        uris.forEach(({uri, status}) => {
            task[uri] ??= taskUriElement(task, uri);
        });
    });
    taskQueueChange(task, gid, status);
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
    task.flist.appendChild(file);
    task.chosen[index] = check.checked;
    task.checks.push(check);
    return {name, ratio};
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
