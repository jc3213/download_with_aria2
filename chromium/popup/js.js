var activeStat = document.querySelector('#active.stats');
var waitingStat = document.querySelector('#waiting.stats');
var stoppedStat = document.querySelector('#stopped.stats');
var downloadStat = document.querySelector('#download.stats');
var uploadStat = document.querySelector('#upload.stats');
var activeQueue = document.querySelector('#queue > .active');
var waitingQueue = document.querySelector('#queue > .waiting');
var pausedQueue = document.querySelector('#queue > .paused');
var completeQueue = document.querySelector('#queue > .complete');
var removedQueue = document.querySelector('#queue > .removed');
var errorQueue = document.querySelector('#queue > .error');
var sessionLET = document.querySelector('div.session');
var fileLET = document.querySelector('div.file');
var uriLET = document.querySelector('div.uri');
var activeId;

document.querySelectorAll('#active_btn, #waiting_btn, #stopped_btn').forEach((tab, index) => {
    var {body} = document;
    var type = 'group' + index;
    tab.addEventListener('click', event => {
        body.className = body.className === type ? '' : type;
    });
});

document.querySelector('#download_btn').addEventListener('click', async event => {
    await aria2NewSession('full');
    close();
});

document.querySelector('#purge_btn').addEventListener('click', async event => {
    await aria2RPC.call('aria2.purgeDownloadResult');
    completeQueue.innerHTML = removedQueue.innerHTML = errorQueue.innerHTML = '';
    stoppedStat.innerText = '0';
    if (stoppedTask.includes(activeId)) {
        activeId = null;
    }
});

document.querySelector('#options_btn').addEventListener('click', event => {
    chrome.runtime.openOptionsPage();
    close();
});

function aria2StartUp() {
    activeTask = [];
    waitingTask = [];
    stoppedTask = [];
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
    aria2RPC.call('aria2.tellWaiting', [0, 999]).then(async waiting => {
        updateManager();
        var stopped = await aria2RPC.call('aria2.tellStopped', [0, 999]);
        [...waiting, ...stopped].forEach(printSession);
        aria2Client();
    }).catch(error => {
        activeStat.innertext = waitingStat.innerText = stoppedStat.innerText = downloadStat.innerText = uploadStat.innerText = '0';
        activeQueue.innerHTML = waitingQueue.innerHTML = pausedQueue.innerHTML = completeQueue.innerHTML = removedQueue.innerHTML = errorQueue.innerHTML = '';
    });
}

function aria2Client() {
    aria2Alive = setInterval(updateManager, aria2Store['refresh_interval']);
    aria2Socket = new WebSocket(aria2Store['jsonrpc_uri'].replace('http', 'ws'));
    aria2Socket.onmessage = async event => {
        var {method, params: [{gid}]} = JSON.parse(event.data);
        if (method !== 'aria2.onBtDownloadComplete') {
            addSession(gid);
            if (method === 'aria2.onDownloadStart' && waitingTask.includes(gid)) {
                removeSession('waiting', gid);
            }
            else if (method !== 'aria2.onDownloadStart' && activeTask.includes(gid)) {
                removeSession('active', gid);
            }
        }
    };
}

async function updateManager() {
    var download = 0;
    var upload = 0;
    var active = await aria2RPC.call('aria2.tellActive');
    active.forEach(result => {
        printSession(result);
        download += result.downloadSpeed | 0;
        upload += result.uploadSpeed | 0;
    });
    downloadStat.innerText = getFileSize(download);
    uploadStat.innerText = getFileSize(upload);
}

function updateSession(task, status) {
    if (status === 'active') {
        var type = 'active';
    }
    else if ('waiting,paused'.includes(status)) {
        type = 'waiting';
    }
    else {
        type = 'stopped';
        task.querySelectorAll('input, select').forEach(entry => {
            entry.disabled = true
        });
        if (task.classList.contains('http') && status !== 'complete') {
            task.querySelector('#retry_btn').style.display = 'inline-block';
        }
    }
    self[status + 'Queue'].appendChild(task);
    return type;
}

async function addSession(gid) {
    var result = await aria2RPC.call('aria2.tellStatus', [gid]);
    var task = printSession(result);
    var {status} = result;
    var type = task.type = updateSession(task, status);
    if (self[type + 'Task'].indexOf(gid) === -1) {
        self[type + 'Stat'].innerText ++;
        self[type + 'Task'].push(gid);
    }
}

function removeSession(type, gid, task) {
    self[type + 'Stat'].innerText --;
    self[type + 'Task'].splice(self[type + 'Task'].indexOf(gid), 1);
    if (task) {
        task.remove();
    }
    if (activeId === gid) {
        activeId = null;
    }
}

function printSession({gid, status, files, bittorrent, completedLength, totalLength, downloadSpeed, uploadSpeed, connections, numSeeders}) {
    var task = document.getElementById(gid) ?? parseSession(gid, status, bittorrent);
    task.querySelector('#name').innerText = getDownloadName(bittorrent, files);
    task.querySelector('#local').innerText = getFileSize(completedLength);
    task.querySelector('#remote').innerText = getFileSize(totalLength);
    var time = (totalLength - completedLength) / downloadSpeed;
    var days = time / 86400 | 0;
    var hours = time / 3600 - days * 24 | 0;
    var minutes = time / 60 - days * 1440 - hours * 60 | 0;
    var seconds = time - days * 86400 - hours * 3600 - minutes * 60 | 0;
    task.querySelector('#day').innerText = days > 0 ? days : '';
    task.querySelector('#hour').innerText = hours > 0 ? hours : '';
    task.querySelector('#minute').innerText = minutes > 0 ? minutes : '';
    task.querySelector('#second').innerText = seconds > 0 ? seconds : '';
    task.querySelector('#connect').innerText = bittorrent ? numSeeders + ' (' + connections + ')' : connections;
    task.querySelector('#download').innerText = getFileSize(downloadSpeed);
    task.querySelector('#upload').innerText = getFileSize(uploadSpeed);
    var ratio = (completedLength / totalLength * 10000 | 0) / 100;
    task.querySelector('#ratio').innerText = ratio;
    task.querySelector('#ratio').style.width = ratio + '%';
    if (activeId === gid && status === 'active') {
        printTaskFiles(task, files);
    }
    return task;
}

function parseSession(gid, status, bittorrent) {
    var task = sessionLET.cloneNode(true);
    task.id = gid;
    if (bittorrent) {
        task.classList.add('p2p');
    }
    else {
        task.classList.add('http');
        task.querySelector('[name="max-upload-limit"]').disabled = true;
    }
    task.querySelector('#remove_btn').addEventListener('click', async event => {
        var status = task.parentNode.className;
        if ('active,waiting,paused'.includes(status)) {
            await aria2RPC.call('aria2.forceRemove', [gid]);
            if (status !== 'active') {
                removeSession('waiting', gid, task);
            }
        }
        else {
            await aria2RPC.call('aria2.removeDownloadResult', [gid]);
            removeSession('stopped', gid, task);
        }
    });
    task.querySelector('#invest_btn').addEventListener('click', async event => {
        if (activeId === gid) {
            activeId = clearTaskDetail();
        }
        else {
            if (activeId) {
                clearTaskDetail();
            }
            var options = await aria2RPC.call('aria2.getOption', [gid]);
            task.querySelectorAll('[name]').printOptions(options);
            var {status, bittorrent, files} = await aria2RPC.call('aria2.tellStatus', [gid]);
            printTaskFiles(task, files);
            task.classList.add('extra');
            activeId = gid;
        }
    });
    task.querySelector('#retry_btn').addEventListener('click', async event => {
        var [{path, uris}] = await aria2RPC.call('aria2.getFiles', [gid]);
        var url = [...new Set(uris.map(({uri}) => uri))];
        var options = await aria2RPC.call('aria2.getOption', [gid]);
        if (path) {
            var li = path.lastIndexOf('/');
            options['dir'] = path.slice(0, li);
            options['out'] = path.slice(li + 1);
        }
        await aria2RPC.call('aria2.removeDownloadResult', [gid]);
        var id = await aria2RPC.call('aria2.addUri', [url, options]);
        addSession(id);
        removeSession('stopped', gid, task);
    });
    task.querySelector('#meter').addEventListener('click', async event => {
        var status = task.parentNode.className;
        if ('active,waiting'.includes(status)) {
            await aria2RPC.call('aria2.forcePause', [gid]);
        }
        else if (status === 'paused') {
            await aria2RPC.call('aria2.unpause', [gid]);
        }
    });
    task.querySelector('#options').addEventListener('change', event => {
        var {name, value} = event.target;
        aria2RPC.call('aria2.changeOption', [gid, {[name]: value}]);
    });
    task.querySelector('#proxy_btn').addEventListener('click', async event => {
        await aria2RPC.call('aria2.changeOption', [gid, {'all-proxy': aria2Store['proxy_server']}]);
        event.target.previousElementSibling.value = aria2Store['proxy_server'];
    });
    task.querySelector('#save_btn').addEventListener('click', async event => {
        var files = [];
        task.querySelectorAll('#files #index').forEach(index => {
            if (index.className === 'active') {
                files.push(index.innerText);
            }
        });
        await aria2RPC.call('aria2.changeOption', [gid, {'select-file': files.join()}]);
        event.target.style.display = 'none';
    });
    task.querySelector('#append_btn').addEventListener('click', async event => {
        var uri = event.target.previousElementSibling;
        await aria2RPC.call('aria2.changeUri', [gid, 1, [], [uri.value]]);
        uri.value = '';
    });
    var type = task.type = updateSession(task, status);
    self[type + 'Stat'].innerText ++;
    self[type + 'Task'].push(gid);
    return task;
}

function clearTaskDetail() {
    var task = document.getElementById(activeId);
    task.classList.remove('extra');
    task.querySelector('#files').innerHTML = task.querySelector('#uris').innerHTML = '';
    task.querySelector('#save_btn').style.display = 'none';
}

function printFileCell(task, list, {index, path, length, selected, uris}) {
    var column = fileLET.cloneNode(true);
    var tile = column.querySelector('#index');
    tile.innerText = index;
    tile.className = selected === 'true' ? 'checked' : 'suspend';
    column.querySelector('#name').innerText = path.slice(path.lastIndexOf('/') + 1);
    column.querySelector('#name').title = path;
    column.querySelector('#size').innerText = getFileSize(length);
    if (uris.length === 0) {
        tile.addEventListener('click', event => {
            if (task.type !== 'stopped') {
                tile.className = tile.className === 'checked' ? 'suspend' : 'checked';
                task.querySelector('#save_btn').style.display = 'block';
            }
        });
    }
    else {
        printTaskUris(task, uris);
    }
    list.appendChild(column);
    return column;
}

function printTaskFiles(task, files) {
    var fileList = task.querySelector('#files');
    var columns = fileList.childNodes;
    files.forEach((file, index) => {
        var column = columns[index] ?? printFileCell(task, fileList, file);
        var {length, completedLength} = file;
        column.querySelector('#ratio').innerText = (completedLength / length * 10000 | 0) / 100;
    });
}

function printUriCell(list, uri) {
    var column = uriLET.cloneNode(true);
    column.addEventListener('click', event => {
        if (event.ctrlKey) {
            aria2RPC.call('aria2.changeUri', [activeId, 1, [uri], []]);
        }
        else {
           navigator.clipboard.writeText(uri);
        }
    });
    list.appendChild(column);
    return column;
}

function printTaskUris(task, uris) {
    var uriList = task.querySelector('#uris');
    var columns = uriList.childNodes;
    var used;
    var wait;
    var idx = -1;
    uris.forEach(({uri, status}) => {
        var column = columns[idx] ?? printUriCell(uriList, uri);
        var link = column.querySelector('#uri');
        var {innerText} = link;
        if (innerText !== uri) {
            link.innerText = link.title = uri;
            used = column.querySelector('#used');
            wait = column.querySelector('#wait');
            idx ++;
        }
        if (status === 'used') {
            used.innerText ++;
        }
        else {
            wait.innerText ++;
        }
    });
    columns.forEach((column, index) => {
        if (index > idx) {
            column.remove();
        }
    });
}
