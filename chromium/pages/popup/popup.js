let aria2Tasks = {};
let aria2Queue = {};
let aria2Stats = {};
let aria2Filter = localStorage['queues']?.match(/[^;]+/g) ?? [];
let aria2Proxy;
let aria2Delay;
let aria2Interval;

let manager = document.body.classList;
let [downBtn, purgeBtn, optionsBtn, filterPane, queuePane] = document.querySelectorAll('#menu > button, #filter, #queue');
let [sessionLET, fileLET, uriLET] = document.querySelectorAll('.template > *');

document.querySelectorAll('[data-tid]').forEach((queue) => aria2Queue[queue.id] = queue);
document.querySelectorAll('[data-sid]').forEach((stat) => aria2Stats[stat.dataset.sid] = stat);

manager.add(...aria2Filter);

filterPane.addEventListener('click', (event) => {
    let id = event.target.dataset.fid;
    let index = aria2Filter.indexOf(id);
    index === -1 ? aria2Filter.push(id) : aria2Filter.splice(index, 1);
    manager.toggle(id);
    localStorage['queues'] = aria2Filter.join(';');
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
    await aria2RPC.call({method: 'aria2.purgeDownloadResult'});
    aria2Queue.complete.innerHTML = aria2Queue.removed.innerHTML = aria2Queue.error.innerHTML = '';
    aria2Stats.stopped.textContent = '0';
    aria2Tasks.stopped = {};
    aria2Tasks.total = {...aria2Tasks.active, ...aria2Tasks.waiting};
});

async function aria2ClientOpened() {
    aria2Tasks = {active: {}, waiting: {}, stopped: {}, total: {}};
    let [global, active, waiting, stopped] = await aria2RPC.call( {method: 'aria2.getGlobalStat'}, {method: 'aria2.tellActive'}, {method: 'aria2.tellWaiting', params: [0, 999]}, {method: 'aria2.tellStopped', params: [0, 999]} );
    [...active.result, ...waiting.result, ...stopped.result].forEach(taskElementSync);
    aria2Stats.download.textContent = getFileSize(global.result.downloadSpeed);
    aria2Stats.upload.textContent = getFileSize(global.result.uploadSpeed);
    aria2Interval = setInterval(aria2ClientUpdate, aria2Delay);
}

function aria2ClientClosed() {
    clearInterval(aria2Interval);
    aria2Stats.active.textContent = aria2Stats.waiting.textContent = aria2Stats.stopped.textContent = aria2Stats.download.textContent = aria2Stats.upload.textContent = '0';
    aria2Queue.active.innerHTML = aria2Queue.waiting.innerHTML = aria2Queue.paused.innerHTML = aria2Queue.complete.innerHTML = aria2Queue.removed.innerHTML = aria2Queue.error.innerHTML = '';
}

function aria2ClientMessage({method, params}) {
    let {gid} = params[0];
    switch (method) {
        case 'aria2.onBtDownloadComplete':
            break;
        case 'aria2.onDownloadStart':
            taskElementUpdate(gid);
            if (aria2Tasks.waiting[gid]) {
                taskElementRemove('waiting', gid);
            }
            break;
        default:
            taskElementUpdate(gid);
            if (aria2Tasks.active[gid]) {
                taskElementRemove('active', gid);
            }
            break;
    }
}

async function aria2ClientUpdate() {
    let [global, active] = await aria2RPC.call( {method: 'aria2.getGlobalStat'}, {method: 'aria2.tellActive'} );
    active.result.forEach(taskElementSync);
    aria2Stats.download.textContent = getFileSize(global.result.downloadSpeed);
    aria2Stats.upload.textContent = getFileSize(global.result.uploadSpeed);
}

function taskStatusChange(task, gid, status) {
    let queue = aria2Queue[status];
    let type = queue.dataset.tid;
    if (!aria2Tasks[type][gid]) {
        aria2Tasks[type][gid] = task;
        aria2Stats[type].textContent ++;
    }
    queue.appendChild(task);
    task.status = status;
}

async function taskElementUpdate(gid) {
    let [session] = await aria2RPC.call({method: 'aria2.tellStatus', params: [gid]});
    let task = taskElementSync(session.result);
    taskStatusChange(task, gid, session.result.status);
}

function taskElementRemove(queue, gid, task) {
    delete aria2Tasks[queue][gid];
    aria2Stats[queue].textContent --;
    if (task) {
        task.remove();
        delete aria2Tasks.total[gid];
    }
}

function taskElementSync({gid, status, files, bittorrent, completedLength, totalLength, downloadSpeed, uploadSpeed, connections, numSeeders}) {
    let task = aria2Tasks.total[gid] ??= taskElementCreate(gid, status, bittorrent, files);
    let time = (totalLength - completedLength) / downloadSpeed;
    let days = time / 86400 | 0;
    let hours = time / 3600 - days * 24 | 0;
    let minutes = time / 60 - days * 1440 - hours * 60 | 0;
    let seconds = time - days * 86400 - hours * 3600 - minutes * 60 | 0;
    let percent = (completedLength / totalLength * 10000 | 0) / 100;
    task.name.textContent = getSessionName(gid, bittorrent, files);
    task.completed.textContent = getFileSize(completedLength);
    task.total.textContent = getFileSize(totalLength);
    task.day.textContent = days || '';
    task.hour.textContent = hours || '';
    task.minute.textContent = minutes || '';
    task.second.textContent = seconds || '';
    task.connect.textContent = bittorrent ? numSeeders + '(' + connections + ')' : connections;
    task.download.textContent = getFileSize(downloadSpeed);
    task.upload.textContent = getFileSize(uploadSpeed);
    task.ratio.textContent = percent;
    task.ratio.style.width = percent + '%';
    files.forEach(({index, length, completedLength}) => {
        task[index].textContent = (completedLength / length * 10000 | 0) / 100;
    });
    return task;
}

function taskElementCreate(gid, status, bittorrent, files) {
    let task = sessionLET.cloneNode(true);
    task.querySelectorAll('[class]').forEach((item) => task[item.className] = item);
    task.entries = task.querySelectorAll('[name]');
    task.id = gid;
    task.data = [];
    task.classList.add(bittorrent ? 'p2p' : 'http');
    task.purge.addEventListener('click', async (event) => {
        switch (task.status) {
            case 'active':
                await aria2RPC.call({method: 'aria2.forceRemove', params: [gid]});
                break;
            case 'waiting':
            case 'paused':
                await aria2RPC.call({method: 'aria2.forceRemove', params: [gid]});
                taskElementRemove('waiting', gid, task);
                break;
            case 'complete':
            case 'removed':
            case 'error':
                await aria2RPC.call({method: 'aria2.removeDownloadResult', params: [gid]});
                taskElementRemove('stopped', gid, task);
                break;
        }
    });
    task.detail.addEventListener('click', async (event) => {
        if (aria2Tasks[gid]) {
            delete aria2Tasks[gid];
            task.classList.remove('extra');
            task.savebtn.style.display = '';
        } else {
            aria2Tasks[gid] = true;
            let [files, options] = await aria2RPC.call( {method: 'aria2.getFiles', params: [gid]}, {method: 'aria2.getOption', params: [gid]} );
            let config = options.result;
            config['min-split-size'] = getFileSize(config['min-split-size']);
            config['max-download-limit'] = getFileSize(config['max-download-limit']);
            config['max-upload-limit'] = getFileSize(config['max-upload-limit']);
            task.entries.forEach((entry) => {
                entry.value = config[entry.name] ?? '';
            });
            task.data.forEach((check, index) => {
                check.checked = files.result[index].selected === 'true';
            });
            task.classList.add('extra');
        }
    });
    task.retry.addEventListener('click', async (event) => {
        let [files, options] = await aria2RPC.call( {method: 'aria2.getFiles', params: [gid]}, {method: 'aria2.getOption', params: [gid]} );
        let {uris, path} = files.result[0];
        let url = [...new Set(uris.map(({uri}) => uri))];
        if (path) {
            let ni = path.lastIndexOf('/');
            options.result['dir'] = path.slice(0, ni);
            options.result['out'] = path.slice(ni + 1);
        }
        let [added] = await aria2RPC.call( {method: 'aria2.addUri', params: [url, options.result]}, {method: 'aria2.removeDownloadResult', params: [gid]} );
        taskElementUpdate(added.result);
        taskElementRemove('stopped', gid, task);
    });
    task.meter.addEventListener('click', async (event) => {
        switch (task.status) {
            case 'active':
            case 'waiting':
                await aria2RPC.call({method: 'aria2.forcePause', params: [gid]});
                aria2Queue.paused.appendChild(task);
                break;
            case 'paused':
                await aria2RPC.call({method: 'aria2.unpause', params: [gid]});
                aria2Queue.waiting.appendChild(task);
                break;
        }
    });
    task.proxybtn.addEventListener('click', async (event) => {
        await aria2RPC.call({method: 'aria2.changeOption', params: [gid, {'all-proxy': aria2Proxy}]});
        task.proxybtn.previousElementSibling.value = aria2Proxy;
    });
    task.savebtn.addEventListener('click', async (event) => {
        let selected = [...task.files.querySelectorAll(':checked + label')].map((index) => index.textContent);
        await aria2RPC.call({method: 'aria2.changeOption', params: [gid, {'select-file': selected.join()}]});
        task.savebtn.style.display = '';
    });
    task.adduri.addEventListener('click', async (event) => {
        let uri = task.adduri.previousElementSibling;
        await aria2RPC.call({method: 'aria2.changeUri', params: [gid, 1, [], [uri.value]]});
        uri.value = '';
    });
    task.options.addEventListener('change', (event) => {
        aria2RPC.call({method: 'aria2.changeOption', params: [gid, { [event.target.name]: event.target.value }]});
    });
    files.forEach(({index, length, path, selected, uris}) => {
        if (!task[index]) {
            let file = fileLET.cloneNode(true);
            let [check, track, name, size, ratio] = file.children;
            check.id = gid + '_' + index;
            check.checked = selected === 'true';
            track.textContent = index;
            track.setAttribute('for', check.id);
            track.addEventListener('click', (event) => {
                task.savebtn.style.display = 'block';
            });
            name.textContent = path.slice(path.lastIndexOf('/') + 1);
            name.title = path;
            size.textContent = getFileSize(length);
            task.files.appendChild(file);
            task[index] = ratio;
            task.data.push(check);
        }
        uris.forEach(({uri, status}) => {
            if (!task[uri]) {
                let url = uriLET.cloneNode(true);
                url.title = url.textContent = uri;
                url.addEventListener('click', (event) => {
                    navigator.clipboard.writeText(uri);
                });
                task.uris.appendChild(url);
                task[uri] = true;
            }
        });
    });
    taskStatusChange(task, gid, status);
    return task;
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

function getSessionName(gid, bittorrent, [{path, uris}]) {
    return bittorrent?.info?.name || path?.slice(path.lastIndexOf('/') + 1) || uris[0]?.uri || gid;
}
