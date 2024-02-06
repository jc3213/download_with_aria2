var manager = document.body;
var detailed;
var aria2Alive;
var aria2Socket;
var aria2Queue = localStorage['queues']?.match(/[^\s,]+/g) ?? [];
var optionsbtn = document.querySelector('#options_btn');
var chooseQueue = document.querySelector('#choose');
var [downloadStat, uploadStat, activeStat, waitingStat, stoppedStat] = document.querySelectorAll('#status > *');
var [allQueues, activeQueue, waitingQueue, pausedQueue, completeQueue, removedQueue, errorQueue] = document.querySelectorAll('#queue, #queue > *');
var [sessionLET, fileLET, uriLET] = document.querySelectorAll('.template > *');

manager.classList.add(...aria2Queue);
chooseQueue.addEventListener('click', (event) => {
    var {qid} = event.target.dataset;
    var qpo = aria2Queue.indexOf(qid);
    qpo === -1 ? aria2Queue.push(qid) : aria2Queue.splice(qpo, 1);
    manager.classList.toggle(qid);
    localStorage['queues'] = aria2Queue.join(', ');
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
    await aria2RPC.call('aria2.purgeDownloadResult');
    completeQueue.innerHTML = removedQueue.innerHTML = errorQueue.innerHTML = '';
    stoppedStat.textContent = '0';
    stoppedTask = {};
    globalTask = {...activeTask, ...waitingTask};
}

function aria2StartUp() {
    activeTask = {};
    waitingTask = {};
    stoppedTask = {};
    globalTask = {};
    aria2RPC = new Aria2(aria2Server, aria2Token);
    aria2RPC.batch([
        ['aria2.getGlobalStat'], ['aria2.tellActive'],
        ['aria2.tellWaiting', 0, 999], ['aria2.tellStopped', 0, 999]
    ]).then(([{downloadSpeed, uploadSpeed}, active, waiting, stopped]) => {
        [...active, ...waiting, ...stopped].forEach(sessionUpdated);
        downloadStat.textContent = getFileSize(downloadSpeed);
        uploadStat.textContent = getFileSize(uploadSpeed);
        aria2ClientSetUp();
    }).catch((error) => {
        activeStat.textContent = waitingStat.textContent = stoppedStat.textContent = downloadStat.textContent = uploadStat.textContent = '0';
        activeQueue.innerHTML = waitingQueue.innerHTML = pausedQueue.innerHTML = completeQueue.innerHTML = removedQueue.innerHTML = errorQueue.innerHTML = '';
    });
}

function aria2ClientSetUp() {
    aria2Alive = setInterval(updateManager, aria2Interval);
    aria2RPC.onmessage = async ({method, params: [{gid}]}) => {
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
        }
    };
}

async function updateManager() {
    var [{downloadSpeed, uploadSpeed}, active] = await aria2RPC.batch([
        ['aria2.getGlobalStat'], ['aria2.tellActive']
    ]);
    active.forEach(sessionUpdated);
    downloadStat.textContent = getFileSize(downloadSpeed);
    uploadStat.textContent = getFileSize(uploadSpeed);
}

function sessionStatusChange(task, gid, status) {
    var cate = status === 'active' ? 'active' : 'waiting,paused'.includes(status) ? 'waiting' : 'stopped';
    if (self[`${cate}Task`][gid] === undefined) {
        self[`${cate}Task`][gid] = task;
        self[`${cate}Stat`].textContent ++;
    }
    self[`${status}Queue`].appendChild(task);
    task.cate = cate;
}

async function sessionCreated(gid) {
    var result = await aria2RPC.call('aria2.tellStatus', gid);
    var task = sessionUpdated(result);
    var {status} = result;
    sessionStatusChange(task, gid, status);
}

function sessionRemoved(cate, gid, task) {
    self[`${cate}Stat`].textContent --;
    delete self[`${cate}Task`][gid];
    if (task) {
        task.remove();
        delete globalTask[gid];
    }
}

function sessionUpdated({gid, status, files, bittorrent, completedLength, totalLength, downloadSpeed, uploadSpeed, connections, numSeeders}) {
    var task = globalTask[gid] ?? createSession(gid, status, bittorrent);
    var time = (totalLength - completedLength) / downloadSpeed;
    var days = time / 86400 | 0;
    var hours = time / 3600 - days * 24 | 0;
    var minutes = time / 60 - days * 1440 - hours * 60 | 0;
    var seconds = time - days * 86400 - hours * 3600 - minutes * 60 | 0;
    var percent = (completedLength / totalLength * 10000 | 0) / 100;
    var {name, completed, total, day, hour, minute, second, connect, download, upload, ratio} = task;
    name.textContent = getDownloadName(gid, bittorrent, files);
    completed.textContent = getFileSize(completedLength);
    total.textContent = getFileSize(totalLength);
    day.textContent = days > 0 ? days : '';
    hour.textContent = hours > 0 ? hours : '';
    minute.textContent = minutes > 0 ? minutes : '';
    second.textContent = seconds > 0 ? seconds : '';
    connect.textContent = bittorrent ? `${numSeeders} (${connections})` : connections;
    download.textContent = getFileSize(downloadSpeed);
    upload.textContent = getFileSize(uploadSpeed);
    ratio.textContent = percent;
    ratio.style.width = `${percent}%`;
    if (detailed === task) {
        printTaskFileList(files);
    }
    return task;
}

function createSession(gid, status, bittorrent) {
    var task = sessionLET.cloneNode(true);
    var [name, completed, day, hour, minute, second, total, connect, download, upload, ratio, files, save, urls] = task.querySelectorAll('.name, .completed, .day, .hour, .minute, .second, .total, .connect, .download, .upload, .ratio, .files, .files + button, .uris');
    var settings = task.querySelectorAll('input, select');
    Object.assign(task, {name, completed, day, hour, minute, second, total, connect, download, upload, ratio, files, save, urls, settings});
    task.id = gid;
    task.classList.add(bittorrent ? 'p2p' : 'http');
    task.addEventListener('click', async ({target, ctrlKey}) => {
        var status = task.parentNode.id;
        switch (target.dataset.bid) {
            case 'remove_btn':
                taskRemove(task, gid, status);
                break;
            case 'detail_btn':
                taskDetail(task, gid);
                break;
            case 'retry_btn':
                taskRetry(task, gid);
                break;
            case 'pause_btn':
                taskPause(task, gid, status);
                break;
            case 'proxy_btn':
                taskProxy(target, gid);
                break;
            case 'save_btn':
                taskFiles(files, save, gid);
                break;
            case 'file_btn':
                taskSelectFile(save, task.cate, target);
                break;
            case 'adduri_btn':
                taskAddUri(target, gid);
                break;
            case 'uri_btn':
                taskRemoveUri(target.textContent, gid, ctrlKey);
                break;
        }
    });
    task.addEventListener('change', (event) => {
        var {dataset: {rid}, value} = event.target;
        if (rid) {
            var {options} = task;
            options[rid] = value;
            aria2RPC.call('aria2.changeOption', gid, options);
        }
    });
    globalTask[gid] = task;
    sessionStatusChange(task, gid, status);
    return task;
}

async function taskRemove(task, gid, status) {
    switch (status) {
        case 'waiting':
        case 'paused':
            sessionRemoved('waiting', gid, task);
        case 'active':
            await aria2RPC.call('aria2.forceRemove', gid);
            break;
        default:
            await aria2RPC.call('aria2.removeDownloadResult', gid);
            sessionRemoved('stopped', gid, task);
    }
}

async function taskDetail(task, gid) {
    if (detailed) {
        detailed.classList.remove('extra');
        detailed.files.innerHTML = detailed.urls.innerHTML = '';
        detailed.save.style.display = 'none';
    }
    if (detailed === task) {
        detailed = null;
        return;
    }
    var [files, options] = await getTaskDetail(gid);
    detailed = task;
    detailed.options = detailed.settings.disposition(options);
    detailed.classList.add('extra');
    printTaskFileList(files);
}

async function taskRetry(task, gid) {
    var [files, options] = await getTaskDetail(gid);
    var {uris, path} = files[0];
    var url = [...new Set(uris.map(({uri}) => uri))];
    if (path) {
        var ni = path.lastIndexOf('/');
        options['dir'] = path.slice(0, ni);
        options['out'] = path.slice(ni + 1);
     }
     var [id] = await aria2RPC.batch([
        ['aria2.addUri', url, options], ['aria2.removeDownloadResult', gid]
     ]);
     sessionCreated(id);
     sessionRemoved('stopped', gid, task);
}

async function taskPause(task, gid, status) {
    switch (status) {
        case 'active':
        case 'waiting':
            await aria2RPC.call('aria2.forcePause', gid);
            pausedQueue.appendChild(task);
            break;
        case 'paused':
            await aria2RPC.call('aria2.unpause', gid);
            waitingQueue.appendChild(task);
            break;
    }
}

async function taskProxy(proxy, gid) {
    await aria2RPC.call('aria2.changeOption', gid, {'all-proxy': aria2Proxy});
    proxy.previousElementSibling.value = aria2Proxy;
}

async function taskFiles(files, save, gid) {
    var selected = [...files.querySelectorAll('.ready')].map(index => index.textContent);
    await aria2RPC.call('aria2.changeOption', gid, {'select-file': selected.join()});
    save.style.display = 'none';
}

function taskSelectFile(save, cate, file) {
    if (cate !== 'stopped' && file.checkbox) {
        file.className = file.className === 'ready' ? '' : 'ready';
        save.style.display = 'block';
    }
}

async function taskAddUri(adduri, gid) {
    var uri = adduri.previousElementSibling;
    await aria2RPC.call('aria2.changeUri', gid, 1, [], [uri.value]);
    uri.value = '';
}

async function taskRemoveUri(uri, gid, ctrl) {
    ctrl ? aria2RPC.call('aria2.changeUri', gid, 1, [uri], []) : navigator.clipboard.writeText(uri);
}

function getTaskDetail(gid) {
    return aria2RPC.batch([
        ['aria2.getFiles', gid], ['aria2.getOption', gid]
    ]);
}

function printFileItem(list, index, path, length, selected, uris) {
    var item = fileLET.cloneNode(true);
    var [file, name, size, ratio] = item.querySelectorAll('div');
    Object.assign(item, {file, name, size, ratio});
    file.checkbox = uris.length === 0; 
    file.textContent = index;
    file.className = selected === 'true' ? 'ready' : '';
    name.textContent = path.slice(path.lastIndexOf('/') + 1);
    name.title = path;
    size.textContent = getFileSize(length);
    list.appendChild(item);
    return item;
}

function printTaskFileList(files) {
    var fileList = detailed.files;
    var items = [...fileList.childNodes];
    files.forEach(({index, path, length, selected, completedLength, uris}, step) => {
        var item = items[step] ?? printFileItem(fileList, index, path, length, selected, uris);
        item.ratio.textContent = (completedLength / length * 10000 | 0) / 100;
        if (uris.length !== 0) {
            printTaskUriList(uris);
        }
    });
}

function printUriItem(list, uri) {
    var item = uriLET.cloneNode(true);
    var [url, used, wait] = item.querySelectorAll('div');
    Object.assign(item, {url, used, wait});
    list.appendChild(item);
    return item;
}

function printTaskUriList(uris) {
    var uriList = detailed.urls;
    var items = [...uriList.childNodes];
    var result = {};
    var urls = [];
    uris.forEach(({uri, status}) => {
        var {yes, no} = result[uri] ?? {yes: 0, no: 0};
        if (yes === 0 && no === 0) {
            urls.push(uri);
        }
        status === 'used' ? yes ++ : no ++;
        result[uri] = {yes, no};
    });
    urls.forEach((uri, step) => {
        var item = items[step] ?? printUriItem(uriList, uri);
        var {yes, no} = result[uri];
        var {url, used, wait} = item;
        url.textContent = uri;
        used.textContent = yes;
        wait.textContent = no;
    });
    items.slice(urls.length).forEach((item) => item.remove());
}
