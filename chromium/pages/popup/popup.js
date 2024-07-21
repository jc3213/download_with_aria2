var aria2Detail;
var aria2Alive;
var aria2Retry;
var aria2SizeKeys = ['min-split-size','max-download-limit','max-upload-limit'];
var aria2Queue = localStorage['queues']?.match(/[^;]+/g) ?? [];
var manager = document.body.classList;
var chooseQueue = document.querySelector('#choose');
var [downloadStat, uploadStat, activeStat, waitingStat, stoppedStat] = document.querySelectorAll('#status > *');
var [allQueues, activeQueue, waitingQueue, pausedQueue, completeQueue, removedQueue, errorQueue] = document.querySelectorAll('#queue, #queue > *');
var [sessionLET, fileLET, uriLET] = document.querySelectorAll('.template > *');

manager.add(...aria2Queue);

chooseQueue.addEventListener('click', (event) => {
    var {qid} = event.target.dataset;
    var index = aria2Queue.indexOf(qid);
    index === -1 ? aria2Queue.push(qid) : aria2Queue.splice(index, 1);
    manager.toggle(qid);
    localStorage['queues'] = aria2Queue.join(';');
});

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey) {
        switch (event.key) {
            case 'r':
                event.preventDefault();
                managerPurge();
                break;
            case 'd':
                event.preventDefault();
                managerDownload();
                break;
            case 's':
                event.preventDefault();
                managerOptions();
                break;
        }
    }
});

document.querySelector('#menu').addEventListener('click', (event) => {
    switch (event.target.id) {
        case 'purge_btn':
            managerPurge();
            break;
        case 'download_btn':
            managerDownload();
            break;
        case 'options_btn':
            managerOptions();
            break;
    }
});

async function managerPurge() {
    await aria2RPC.call({method: 'aria2.purgeDownloadResult'});
    completeQueue.innerHTML = removedQueue.innerHTML = errorQueue.innerHTML = '';
    stoppedStat.textContent = '0';
    stoppedTask = {};
    globalTask = {...activeTask, ...waitingTask};
}

function aria2ClientSetup() {
    aria2RPC = new Aria2(aria2Scheme, aria2Url, aria2Secret);
    aria2RPC.onmessage = aria2WebSocket;
    aria2RPC.onclose = aria2ClientWorker;
    return aria2ClientWorker();
}

function aria2ClientWorker() {
    clearTimeout(aria2Retry);
    clearInterval(aria2Alive);
    activeTask = {};
    waitingTask = {};
    stoppedTask = {};
    globalTask = {};
    return aria2RPC.call(
        {method: 'aria2.getGlobalStat'}, {method: 'aria2.tellActive'},
        {method: 'aria2.tellWaiting', params: [0, 999]},
        {method: 'aria2.tellStopped', params: [0, 999]}
    ).then(([global, active, waiting, stopped]) => {
        [...active.result, ...waiting.result, ...stopped.result].forEach(sessionUpdated);
        downloadStat.textContent = getFileSize(global.result.downloadSpeed);
        uploadStat.textContent = getFileSize(global.result.uploadSpeed);
        aria2Alive = setInterval(aria2ClientUpdate, aria2Interval);
    }).catch((error) => {
        activeStat.textContent = waitingStat.textContent = stoppedStat.textContent = downloadStat.textContent = uploadStat.textContent = '0';
        activeQueue.innerHTML = waitingQueue.innerHTML = pausedQueue.innerHTML = completeQueue.innerHTML = removedQueue.innerHTML = errorQueue.innerHTML = '';
        aria2Retry = setTimeout(aria2ClientWorker, aria2Interval);
    });
}

function aria2WebSocket({method, params}) {
    if (!method) {
        return;
    }
    var [{gid}] = params;
    switch (method) {
        case 'aria2.onBtDownloadComplete':
            break;
        case 'aria2.onDownloadStart':
            sessionCreated(gid);
            if (waitingTask[gid]) {
                sessionRemoved('waiting', gid);
            }
            break;
        default:
            sessionCreated(gid);
            if (activeTask[gid]) {
                sessionRemoved('active', gid);
            }
            break;
    }
}

async function aria2ClientUpdate() {
    var [global, active] = await aria2RPC.call({method: 'aria2.getGlobalStat'}, {method: 'aria2.tellActive'});
    active.result.forEach(sessionUpdated);
    downloadStat.textContent = getFileSize(global.result.downloadSpeed);
    uploadStat.textContent = getFileSize(global.result.uploadSpeed);
}

function sessionStatusChange(task, gid, status) {
    var queue = status === 'active' ? 'active' : 'waiting,paused'.includes(status) ? 'waiting' : 'stopped';
    if (!self[queue + 'Task'][gid]) {
        self[queue + 'Task'][gid] = task;
        self[queue + 'Stat'].textContent ++;
    }
    self[status + 'Queue'].appendChild(task);
    task.queue = queue;
    task.status = status;
}

async function sessionCreated(gid) {
    var [session] = await aria2RPC.call({method: 'aria2.tellStatus', params: [gid]});
    var task = sessionUpdated(session.result);
    sessionStatusChange(task, gid, session.result.status);
}

function sessionRemoved(queue, gid, task) {
    self[queue + 'Stat'].textContent --;
    delete self[queue + 'Task'][gid];
    if (task) {
        task.remove();
        delete globalTask[gid];
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

function getSessionName(gid, bittorrent, [{path, uris}]) {
    return bittorrent?.info?.name || path?.slice(path.lastIndexOf('/') + 1) || uris[0]?.uri || gid;
}

function sessionUpdated({gid, status, files, bittorrent, completedLength, totalLength, downloadSpeed, uploadSpeed, connections, numSeeders}) {
    var task = globalTask[gid] ?? createSession(gid, status, bittorrent);
    var time = (totalLength - completedLength) / downloadSpeed;
    var days = time / 86400 | 0;
    var hours = time / 3600 - days * 24 | 0;
    var minutes = time / 60 - days * 1440 - hours * 60 | 0;
    var seconds = time - days * 86400 - hours * 3600 - minutes * 60 | 0;
    var percent = (completedLength / totalLength * 10000 | 0) / 100;
    task.dataset.done = completedLength === totalLength;
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
    if (aria2Detail === task) {
        printTaskFileList(files);
    }
    return task;
}

function createSession(gid, status, bittorrent) {
    var task = sessionLET.cloneNode(true);
    task.querySelectorAll('[class]').forEach((item) => task[item.className] = item);
    task.settings = task.querySelectorAll('input, select');
    task.id = gid;
    task.links = [];
    task.classList.add(bittorrent ? 'p2p' : 'http');
    task.addEventListener('click', (event) => {
        switch (event.target.dataset.bid) {
            case 'remove_btn':
                taskRemove(task, gid);
                break;
            case 'detail_btn':
                taskDetail(task, gid);
                break;
            case 'retry_btn':
                taskRetry(task, gid);
                break;
            case 'pause_btn':
                taskPause(task, gid);
                break;
            case 'proxy_btn':
                taskProxy(event.target, gid);
                break;
            case 'save_btn':
                taskChangeFiles(task, gid);
                break;
            case 'file_btn':
                taskSelectFile(task);
                break;
            case 'adduri_btn':
                taskAddUri(event.target, gid);
                break;
            case 'uri_btn':
                taskRemoveUri(event.target.textContent, gid, event.ctrlKey);
                break;
        }
    });
    task.addEventListener('change', (event) => {
        var {dataset: {rid}, value} = event.target;
        if (rid) {
            task.options[rid] = value;
            aria2RPC.call({method: 'aria2.changeOption', params: [gid, task.options]});
        }
    });
    globalTask[gid] = task;
    sessionStatusChange(task, gid, status);
    return task;
}

async function taskRemove(task, gid) {
    switch (task.status) {
        case 'waiting':
        case 'paused':
            sessionRemoved('waiting', gid, task);
        case 'active':
            await aria2RPC.call({method: 'aria2.forceRemove', params: [gid]});
            break;
        default:
            await aria2RPC.call({method: 'aria2.removeDownloadResult', params: [gid]});
            sessionRemoved('stopped', gid, task);
            break;
    }
}

function taskOptionsSetUp(options) {
    aria2SizeKeys.forEach((key) => options[key] = getFileSize(options[key]));
    return options;
}

async function taskDetail(task, gid) {
    if (aria2Detail) {
        aria2Detail.classList.remove('extra');
        aria2Detail.save.style.display = 'none';
    }
    if (aria2Detail === task) {
        aria2Detail = null;
        return;
    }
    var [files, options] = await getTaskDetail(gid);
    aria2Detail = task;
    aria2Detail.options = aria2Detail.settings.disposition(taskOptionsSetUp(options.result));
    aria2Detail.classList.add('extra');
    aria2Detail.scrollIntoView();
    printTaskFileList(files.result);
}

async function taskRetry(task, gid) {
    var [files, options] = await getTaskDetail(gid);
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
     sessionCreated(added.result);
     sessionRemoved('stopped', gid, task);
}

async function taskPause(task, gid) {
    switch (task.status) {
        case 'active':
        case 'waiting':
            await aria2RPC.call({method: 'aria2.forcePause', params: [gid]});
            pausedQueue.appendChild(task);
            break;
        case 'paused':
            await aria2RPC.call({method: 'aria2.unpause', params: [gid]});
            waitingQueue.appendChild(task);
            break;
    }
}

async function taskProxy(proxy, gid) {
    await aria2RPC.call({method: 'aria2.changeOption', params: [gid, {'all-proxy': aria2Proxy}]});
    proxy.previousElementSibling.value = aria2Proxy;
}

async function taskChangeFiles(task, gid) {
    var selected = [...task.files.querySelectorAll(':checked + label')].map((index) => index.textContent);
    await aria2RPC.call({method: 'aria2.changeOption', params: [gid, {'select-file': selected.join()}]});
    task.save.style.display = 'none';
}

function taskSelectFile(task) {
    task.save.style.display = 'block';
}

async function taskAddUri(adduri, gid) {
    var uri = adduri.previousElementSibling;
    await aria2RPC.call({method: 'aria2.changeUri', params: [gid, 1, [], [uri.value]]});
    uri.value = '';
}

async function taskRemoveUri(uri, gid, ctrl) {
    ctrl ? aria2RPC.call({method: 'aria2.changeUri', params: [gid, 1, [uri], []]}) : navigator.clipboard.writeText(uri);
}

function getTaskDetail(gid) {
    return aria2RPC.call(
        {method: 'aria2.getFiles', params: [gid]},
        {method: 'aria2.getOption', params: [gid]}
    );
}

function printFileItem(list, index, selected, path, length) {
    var file = fileLET.cloneNode(true);
    file.querySelectorAll('*').forEach((item) => file[item.className] = item);
    file.check.checked = selected === 'true';
    file.check.id = aria2Detail.id + '_' + index;
    file.index.textContent = index;
    file.index.setAttribute('for', file.check.id);
    file.name.textContent = path.slice(path.lastIndexOf('/') + 1);
    file.name.title = path;
    file.size.textContent = getFileSize(length);
    list.append(file);
    list[index] = file;
    return file;
}

function printTaskFileList(files) {
    var fileList = aria2Detail.files;
    files.forEach(({index, path, length, selected, completedLength, uris}) => {
        var item = fileList[index] ?? printFileItem(fileList, index, selected, path, length);
        item.ratio.textContent = (completedLength / length * 10000 | 0) / 100;
        printTaskUriList(uris);
    });
}

function printUriItem(list, links, uri) {
    var url = uriLET.cloneNode(true);
    url.querySelectorAll('*').forEach((div) => url[div.className] = div);
    url.link.textContent = uri;
    list[uri] = url;
    list.append(url);
    links.push(uri);
    return url;
}

function printTaskUriList(uris) {
    if (uris.length === 0) {
        return;
    }
    var uriList = aria2Detail.uris;
    var links = aria2Detail.links;
    var result = {};
    uris.forEach(({uri, status}) => {
        var item = uriList[uri] ?? printUriItem(uriList, links, uri);
        var {used, wait} = result[uri] ?? {used: 0, wait: 0};
        status === 'used' ? used ++ : wait ++;
        result[uri] = {used, wait};
    });
    links.forEach((uri) => {
        if (result[uri] === undefined) {
            uriList[uri].remove();
            delete uriList[uri];
            return links.splice(links.indexOf(uri), 1);
        }
        uriList[uri].used.textContent = result[uri].used;
        uriList[uri].wait.textContent = result[uri].wait;
    });
}
