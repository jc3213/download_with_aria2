var aria2Tasks = {};
var aria2Queue = {};
var aria2Stats = {};
var aria2Detail = {};
var aria2Filter = localStorage['queues']?.match(/[^;]+/g) ?? [];
var aria2Proxy;
var aria2Delay;
var aria2Interval;

var manager = document.body.classList;
var [downBtn, purgeBtn, optionsBtn, filterPane, queuePane] = document.querySelectorAll('#menu > button, #filter, #queue');
var [sessionLET, fileLET, uriLET] = document.querySelectorAll('.template > *');

document.querySelectorAll('[data-tid]').forEach((queue) => aria2Queue[queue.id] = queue);
document.querySelectorAll('[data-sid]').forEach((stat) => aria2Stats[stat.dataset.sid] = stat);

manager.add(...aria2Filter);

filterPane.addEventListener('click', (event) => {
    var id = event.target.dataset.fid;
    var index = aria2Filter.indexOf(id);
    index === -1 ? aria2Filter.push(id) : aria2Filter.splice(index, 1);
    manager.toggle(id);
    localStorage['queues'] = aria2Filter.join(';');
});

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey) {
        switch (event.key) {
            case 'r':
                event.preventDefault();
                purgeBtn.click();
                break;
            case 'd':
                event.preventDefault();
                downBtn.click();
                break;
            case 's':
                event.preventDefault();
                optionsBtn.click();
                break;
        }
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
    var [global, active, waiting, stopped] = await aria2RPC.call( {method: 'aria2.getGlobalStat'}, {method: 'aria2.tellActive'}, {method: 'aria2.tellWaiting', params: [0, 999]}, {method: 'aria2.tellStopped', params: [0, 999]} );
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
    var gid = params[0].gid;
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
    var [global, active] = await aria2RPC.call({method: 'aria2.getGlobalStat'}, {method: 'aria2.tellActive'});
    active.result.forEach(taskElementSync);
    aria2Stats.download.textContent = getFileSize(global.result.downloadSpeed);
    aria2Stats.upload.textContent = getFileSize(global.result.uploadSpeed);
}

function taskStatusChange(task, gid, status) {
    var queue = aria2Queue[status];
    var type = queue.dataset.tid;
    if (!aria2Tasks[type][gid]) {
        aria2Tasks[type][gid] = task;
        aria2Stats[type].textContent ++;
    }
    queue.appendChild(task);
    task.status = status;
}

async function taskElementUpdate(gid) {
    var [session] = await aria2RPC.call({method: 'aria2.tellStatus', params: [gid]});
    var task = taskElementSync(session.result);
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
    var task = aria2Tasks.total[gid] ??= taskElementCreate(gid, status, bittorrent, files);
    var time = (totalLength - completedLength) / downloadSpeed;
    var days = time / 86400 | 0;
    var hours = time / 3600 - days * 24 | 0;
    var minutes = time / 60 - days * 1440 - hours * 60 | 0;
    var seconds = time - days * 86400 - hours * 3600 - minutes * 60 | 0;
    var percent = (completedLength / totalLength * 10000 | 0) / 100;
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
    if (aria2Detail[gid]) {
        files.forEach(({completedLength, index, length, uris}) => taskDetailSync(gid, task.files[index], completedLength, length, task.uris, uris));
    }
    return task;
}

function taskElementCreate(gid, status, bittorrent, files) {
    var task = sessionLET.cloneNode(true);
    task.querySelectorAll('[class]').forEach((item) => task[item.className] = item);
    task.entries = task.querySelectorAll('[name]');
    task.id = gid;
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
        if (aria2Detail[gid]) {
            task.classList.remove('extra');
            task.save.style.display = 'none';
            delete aria2Detail[gid];
        } else {
            var [files, options] = await aria2RPC.call({method: 'aria2.getFiles', params: [gid]}, {method: 'aria2.getOption', params: [gid]});
            task.classList.add('extra');
            aria2Detail[gid] = true;
            taskDetailOpened(task, gid, files.result, options.result);
        }
    });
    task.start.addEventListener('click', async (event) => {
        var [files, options] = await aria2RPC.call({method: 'aria2.getFiles', params: [gid]}, {method: 'aria2.getOption', params: [gid]});
        var {uris, path} = files.result[0];
        var url = [...new Set(uris.map(({uri}) => uri))];
        if (path) {
            var ni = path.lastIndexOf('/');
            var name = {'dir': path.slice(0, ni), 'out': path.slice(ni + 1)};
        }
        var [added, removed] = await aria2RPC.call(
            {method: 'aria2.addUri', params: [url, {...options.result, ...name}]},
            {method: 'aria2.removeDownloadResult', params: [gid]}
        );
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
    task.proxy.addEventListener('click', async (event) => {
        await aria2RPC.call({method: 'aria2.changeOption', params: [gid, {'all-proxy': aria2Proxy}]});
        task.proxy.previousElementSibling.value = aria2Proxy;
    });
    task.save.addEventListener('click', async (event) => {
        var selected = [...task.files.querySelectorAll(':checked + label')].map((index) => index.textContent);
        await aria2RPC.call({method: 'aria2.changeOption', params: [gid, {'select-file': selected.join()}]});
        task.save.style.display = 'none';
    });
    task.adduri.addEventListener('click', async (event) => {
        var uri = task.adduri.previousElementSibling;
        await aria2RPC.call({method: 'aria2.changeUri', params: [gid, 1, [], [uri.value]]});
        uri.value = '';
    });
    task.options.addEventListener('change', (event) => {
        aria2RPC.call({method: 'aria2.changeOption', params: [gid, {[event.target.name]: event.target.value}]});
    });
    taskStatusChange(task, gid, status);
    return task;
}

function taskDetailOpened(task, gid, files, options) {
    options['min-split-size'] = getFileSize(options['min-split-size']);
    options['max-download-limit'] = getFileSize(options['max-download-limit']);
    options['max-upload-limit'] = getFileSize(options['max-upload-limit']);
    task.uris.uris = [];
    task.entries.forEach((entry) => {
        entry.value = options[entry.name] ?? '';
    });
    files.forEach(({index, length, completedLength, path, selected, uris}) => {
        var file = task.files[index] ?? taskFileElementCreate(task, gid, task.files, index, selected, path, length, uris);
        file.check.checked = selected === 'true';
        file.name.textContent = path.slice(path.lastIndexOf('/') + 1);
        file.name.title = path;
        file.size.textContent = getFileSize(length);
        taskDetailSync(gid, file, completedLength, length, task.uris, uris);
    });
}

function taskDetailSync(gid, file, completed, length, list, uris) {
    file.ratio.textContent = (completed / length * 10000 | 0) / 100;
    if (uris.length === 0) {
        return;
    }
    var result = {};
    uris.forEach(({uri, status}) => {
        taskUriElementCreate(gid, list, uri);
        result[uri] ??= {used: 0, waiting: 0};
        result[uri][status] ++;
    });
    list.uris = list.uris.filter((uri) => {
        if (!result[uri]) {
            list[uri].remove();
            delete list[uri];
            return false;
        }
        list[uri].busy.textContent = result[uri].used;
        list[uri].idle.textContent = result[uri].waiting;
        return true;
    });
}

function taskFileElementCreate(task, gid, list, index, selected, path, length, uris) {
    var file = fileLET.cloneNode(true);
    file.querySelectorAll('*').forEach((item) => file[item.className] = item);
    file.check.id = gid + '_' + index;
    file.index.textContent = index;
    file.index.setAttribute('for', file.check.id);
    file.index.addEventListener('click', (event) => {
        task.save.style.display = 'block';
    });
    list[index] = file;
    list.appendChild(file);
    return file;
}

function taskUriElementCreate(gid, list, uri) {
    if (list[uri]) {
        return;
    }
    var url = uriLET.cloneNode(true);
    url.querySelectorAll('*').forEach((div) => url[div.className] = div);
    url.link.addEventListener('click', (event) => {
        navigator.clipboard.writeText(uri);
    });
    url.link.title = url.link.textContent = uri;
    list.uris.push(uri);
    list[uri] = url;
    list.appendChild(url);
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
