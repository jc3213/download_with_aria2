var activeStat = document.querySelector('#active[data-stat]');
var waitingStat = document.querySelector('#waiting[data-stat]');
var stoppedStat = document.querySelector('#stopped[data-stat]');
var downloadStat = document.querySelector('#download[data-stat]');
var uploadStat = document.querySelector('#upload[data-stat]');
var activeQueue = document.querySelector('[data-queue="active"]');
var waitingQueue = document.querySelector('[data-queue="waiting"]');
var pausedQueue = document.querySelector('[data-queue="paused"]');
var completeQueue = document.querySelector('[data-queue="complete"]');
var removedQueue = document.querySelector('[data-queue="removed"]');
var errorQueue = document.querySelector('[data-queue="error"]');
var sessionLET = document.querySelector('div.session');
var activeId;
var fileLET = document.querySelector('div.file');
var uriLET = document.querySelector('div.uri');

document.querySelectorAll('button.active, button.waiting, button.removed').forEach((tab, index) => {
    tab.addEventListener('click', event => {
        var value = tab.parentNode.getAttribute('data-main') == index ? 3 : index;
        tab.parentNode.setAttribute('data-main', value);
        document.querySelector('#session').setAttribute('data-main', value);
    });
});

document.querySelector('#download_btn').addEventListener('click', async event => {
    await aria2NewSession('full');
    close();
});

document.querySelector('#purge_btn').addEventListener('click', async event => {
    await aria2RPC.message('aria2.purgeDownloadResult');
    completeQueue.innerHTML = removedQueue.innerHTML = errorQueue.innerHTML = '';
    stoppedStat.innerText = '0';
});

document.querySelector('#options_btn').addEventListener('click', event => {
    chrome.runtime.openOptionsPage();
    close();
});

document.querySelector('#append_btn').addEventListener('click', async event => {
    var uri = event.target.parentNode.querySelector('input');
    await aria2RPC.message('aria2.changeUri', [activeId, 1, [], [uri.value]]);
    uri.value = '';
});

function aria2StartUp() {
    activeTask = [];
    waitingTask = [];
    stoppedTask = [];
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
    aria2RPC.message('aria2.tellWaiting', [0, 999]).then(async waiting => {
        updateSession();
        var stopped = await aria2RPC.message('aria2.tellStopped', [0, 999]);
        [...waiting, ...stopped].forEach(printSession);
        aria2Client();
    }).catch(error => {
        activeStat.innertext = waitingStat.innerText = stoppedStat.innerText = downloadStat.innerText = uploadStat.innerText = '0';
        activeQueue.innerHTML = waitingQueue.innerHTML = pausedQueue.innerHTML = completeQueue.innerHTML = removedQueue.innerHTML = errorQueue.innerHTML = '';
    });
}

function aria2Client() {
    aria2Alive = setInterval(updateSession, aria2Store['refresh_interval']);
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

async function updateSession() {
    var download = 0;
    var upload = 0;
    var active = await aria2RPC.message('aria2.tellActive');
    active.forEach(result => {
        printSession(result);
        download += result.downloadSpeed | 0;
        upload += result.uploadSpeed | 0;
    });
    downloadStat.innerText = getFileSize(download);
    uploadStat.innerText = getFileSize(upload);
}

async function addSession(gid) {
    var result = await aria2RPC.message('aria2.tellStatus', [gid]);
    var {status} = result;
    var task = printSession(result);
    if (status === 'active') {
        var type = 'active';
    }
    else {
        type = 'waiting,paused'.includes(status) ? 'waiting' : 'stopped';
        task.querySelector('#infinite').style.display = 'block';
    }
    if (self[type + 'Task'].indexOf(gid) === -1) {
        self[type + 'Stat'].innerText ++;
        self[type + 'Task'].push(gid);
    }
    self[status + 'Queue'].appendChild(task);
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
    var time = (totalLength - completedLength) / downloadSpeed;
    var ratio = (completedLength / totalLength * 10000 | 0) / 100;
    task.setAttribute('status', status);
    task.querySelector('#name').innerText = getDownloadName(bittorrent, files);
    task.querySelector('#local').innerText = getFileSize(completedLength);
    task.querySelector('#remote').innerText = getFileSize(totalLength);
    var days = time / 86400 | 0;
    var hours = time / 3600 - days * 24 | 0;
    var minutes = time / 60 - days * 1440 - hours * 60 | 0;
    var seconds = time - days * 86400 - hours * 3600 - minutes * 60 | 0;
    printEstimateTime(task.querySelector('#day'), days);
    printEstimateTime(task.querySelector('#hour'), hours);
    printEstimateTime(task.querySelector('#minute'), minutes);
    task.querySelector('#second').innerText = seconds;
    task.querySelector('#connect').innerText = bittorrent ? numSeeders + ' (' + connections + ')' : connections;
    task.querySelector('#download').innerText = getFileSize(downloadSpeed);
    task.querySelector('#upload').innerText = getFileSize(uploadSpeed);
    task.querySelector('#ratio').innerText = 
    task.querySelector('#ratio').style.width = ratio + '%';
    task.querySelector('#ratio').className = status;
    task.querySelector('#retry_btn').style.display = !bittorrent && 'error,removed'.includes(status) ? 'inline-block' : 'none';
    if (activeId === gid) {
        updateTaskDetail(task, status, bittorrent, files);
    }
    return task;
}

function printEstimateTime(time, number) {
    if (number > 0) {
        time.innerText = number;
        time.style.display = time.nextElementSibling.style.display = 'inline-block';
    }
    else {
        time.style.display = time.nextElementSibling.style.display = 'none';
    }
}

function parseSession(gid, status, bittorrent) {
    var task = sessionLET.cloneNode(true);
    task.id = gid;
    task.setAttribute('data-type', bittorrent ? 'bt' : 'http');
    task.querySelector('#upload').parentNode.style.display = bittorrent ? 'inline-block' : 'none';
    task.querySelector('#remove_btn').addEventListener('click', async event => {
        var status = task.getAttribute('status');
        if ('active,waiting,paused'.includes(status)) {
            await aria2RPC.message('aria2.forceRemove', [gid]);
            if (status !== 'active') {
                removeSession('waiting', gid, task);
            }
        }
        else {
            await aria2RPC.message('aria2.removeDownloadResult', [gid]);
            removeSession('stopped', gid, task);
        }
    });
    task.querySelector('#invest_btn').addEventListener('click', async event => {
        if (activeId === gid) {
            activeId = null;
            task.classList.remove('extra');
        }
        else {
            if (activeId) {
                document.getElementById(activeId).classList.remove('extra');
            }
            var options = await aria2RPC.message('aria2.getOption', [gid]);
            var entries = task.querySelectorAll('[name]');
            printGlobalOptions(entries, options);
            var {status, bittorrent, files} = await aria2RPC.message('aria2.tellStatus', [gid]);
            updateTaskDetail(task, status, bittorrent, files);
            task.classList.add('extra');
            activeId = gid;
        }
    });
    task.querySelector('#retry_btn').addEventListener('click', async event => {
        var [{path, uris}] = await aria2RPC.message('aria2.getFiles', [gid]);
        var url = [...new Set(uris.map(({uri}) => uri))];
        var options = await aria2RPC.message('aria2.getOption', [gid]);
        if (path) {
            var li = path.lastIndexOf('/');
            options['dir'] = path.slice(0, li);
            options['out'] = path.slice(li + 1);
        }
        await aria2RPC.message('aria2.removeDownloadResult', [gid]);
        var id = await aria2RPC.message('aria2.addUri', [url, options]);
        addSession(id);
        removeSession('stopped', gid, task);
    });
    task.querySelector('#meter').addEventListener('click', async event => {
        var status = task.getAttribute('status');
        if ('active,waiting'.includes(status)) {
            await aria2RPC.message('aria2.forcePause', [gid]);
            task.setAttribute('status', 'paused');
        }
        else if (status === 'paused') {
            await aria2RPC.message('aria2.unpause', [gid]);
            task.setAttribute('status', 'waiting');
        }
    });
    task.querySelector('#options').addEventListener('change', event => {
        var {name, value} = event.target;
        aria2RPC.message('aria2.changeOption', [gid, {[name]: value}]);
    });
    task.querySelector('#proxy_btn').addEventListener('click', async event => {
        await aria2RPC.message('aria2.changeOption', [gid, {'all-proxy': aria2Store['proxy_server']}]);
        event.target.parentNode.querySelector('input').value = aria2Store['proxy_server'];
    });
    task.querySelector('#save_btn').addEventListener('click', async event => {
        var files = [];
        task.querySelectorAll('#files #index').forEach(index => {
            if (index.className === 'active') {
                files.push(index.innerText);
            }
        });
        await aria2RPC.message('aria2.changeOption', [gid, {'select-file': files.join()}]);
        event.target.style.display = 'none';
    });
    var type = status === 'active' ? 'active' : 'waiting,paused'.includes(status) ? 'waiting' : 'stopped';
    self[type + 'Stat'].innerText ++;
    self[type + 'Task'].push(gid);
    self[status + 'Queue'].appendChild(task);
    return task;
}

function updateTaskDetail(task, status, bittorrent, files) {
    var disabled = 'complete,error,removed'.includes(status);
    task.querySelector('[name="max-download-limit"]').disabled = disabled;
    task.querySelector('[name="max-upload-limit"]').disabled = disabled || !bittorrent;
    task.querySelector('[name="all-proxy"]').disabled = disabled;
    printTaskFiles(task, files);
}

function printFileCell(task, list, {index, path, length, selected, uris}) {
    var cell = fileLET.cloneNode(true);
    var tile = cell.querySelector('#index');
    tile.innerText = index;
    tile.className = selected === 'true' ? 'active' : 'error';
    cell.querySelector('#name').innerText = path.slice(path.lastIndexOf('/') + 1);
    cell.querySelector('#name').title = path;
    cell.querySelector('#size').innerText = getFileSize(length);
    if (uris.length === 0) {
        tile.addEventListener('click', event => {
            tile.className = tile.className === 'active' ? 'error' : 'active';
            task.querySelector('#save_btn').style.display = 'block';
        });
    }
    else {
        printTaskUris(task, uris);
    }
    list.appendChild(cell);
    return cell;
}

function printTaskFiles(task, files) {
    var fileList = task.querySelector('#files');
    var cells = fileList.childNodes;
    files.forEach((file, index) => {
        var cell = cells[index] ?? printFileCell(task, fileList, file);
        var {length, completedLength} = file;
        cell.querySelector('#ratio').innerText = ((completedLength / length * 10000 | 0) / 100) + '%';
    });
}

function printUriCell(list, uri) {
    var cell = uriLET.cloneNode(true);
    cell.addEventListener('click', event => {
        if (event.ctrlKey) {
            aria2RPC.message('aria2.changeUri', [activeId, 1, [uri], []]);
        }
        else {
           navigator.clipboard.writeText(uri);
        }
    });
    list.appendChild(cell);
    return cell;
}

function printTaskUris(task, uris) {
    var uriList = task.querySelector('#uris');
    var cells = uriList.childNodes;
    var index = -1;
    var used;
    var wait;
    uris.forEach(({uri, status}) => {
        var cell = cells[index] ?? printUriCell(uriList, uri);
        var link = cell.querySelector('#uri');
        var {innerText} = link;
        if (innerText !== uri) {
            link.innerText = uri;
            used = cell.querySelector('#used');
            wait = cell.querySelector('#wait');
            index ++;
        }
        if (status === 'used') {
            used.innerText ++;
        }
        else {
            wait.innerText ++;
        }
    });
    cells.forEach((cell, cur) => {
        if (cur > index) {
            cell.remove();
        }
    });
}
