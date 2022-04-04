var activeId;
var activeStat = document.querySelector('#active.stats');
var waitingStat = document.querySelector('#waiting.stats');
var stoppedStat = document.querySelector('#stopped.stats');
var downloadStat = document.querySelector('#download.stats');
var uploadStat = document.querySelector('#upload.stats');
var activeQueue = document.querySelector('section#active');
var waitingQueue = document.querySelector('section#waiting');
var stoppedQueue = document.querySelector('section#stopped');
var http = document.querySelector('section#http');
var bt = document.querySelector('section#bt');

document.querySelectorAll('button[class]:not(:disabled)').forEach((tab, index) => {
    tab.addEventListener('click', event => {
        var value = (tab.parentNode.getAttribute('data-main') | 0) === index + 1 ? 0 : index + 1;
        tab.parentNode.setAttribute('data-main', value);
        document.querySelector('#session').setAttribute('data-main', value);
    });
});

document.querySelector('#task_btn').addEventListener('click', async event => {
    var options = await aria2RPC.message('aria2.getGlobalOption');
    printOptions(document.querySelectorAll('#create input[name]'), options);
    document.body.setAttribute('data-popup', 'task');
});

document.querySelector('#purdge_btn').addEventListener('click', async event => {
    await aria2RPC.message('aria2.purgeDownloadResult');
    stoppedTask = [];
    stoppedQueue.innerHTML = '';
    stoppedStat.innerText = '0';
});

document.querySelector('#options_btn').addEventListener('click', event => {
    open('/options/index.html?popup', '_self');
});

document.querySelector('#referer_btn').addEventListener('click', event => {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
        document.querySelector('#referer').value = tabs[0].url;
    });
});

document.querySelector('#proxy_new').addEventListener('click', event => {
    event.target.parentNode.querySelector('input').value = aria2Store['proxy_server'];
});

document.querySelector('#submit_btn').addEventListener('click', event => {
    var options = createOptions();
    var entries = document.querySelector('#entries').value.match(/(https?:\/\/|ftp:\/\/|magnet:\?)[^\s\n]+/g);
    entries && entries.forEach(async url => {
        await aria2RPC.message('aria2.addUri', [[url], options]);
        showNotification(url);
    });
    document.querySelector('#entries').value = '';
    document.body.setAttribute('data-popup', 'main');
});

document.querySelector('#upload_btn').style.display = 'browser' in this ? 'none' : 'inline-block';
document.querySelector('#upload_btn').addEventListener('change', event => {
    var options = createOptions();
    [...event.target.files].forEach(async file => {
        var {method, params = []} = file.name.endsWith('torrent') ? {method: 'aria2.addTorrent'} : {method: 'aria2.addMetalink', params: [options]};
        var data = await promiseFileReader(file, 'readAsDataURL');
        await aria2RPC.message(method, [data.slice(data.indexOf(',') + 1), ...params]);
        showNotification(file.name);
    });
    event.target.value = '';
    document.body.setAttribute('data-popup', 'main');
});

document.querySelector('#name_btn').addEventListener('click', event => {
    activeId = http.innerHTML = bt.innerHTML = '';
    fileManager = [];
    document.body.setAttribute('data-popup', 'main');
});

document.querySelector('#manager').addEventListener('change', event => {
    event.target.name && aria2RPC.message('aria2.changeOption', [activeId, {[event.target.name]: event.target.value}]);
});

document.querySelectorAll('#manager .block').forEach(block => {
    var field = block.parentNode.querySelector('input');
    block.addEventListener('click', event => {
        block.style.display = field.disabled ? 'block' : field.focus() ?? 'none';
    });
    field.addEventListener('blur', event => {
        block.style.display = 'block';
    });
});

document.querySelector('#proxy_mgr').addEventListener('click', async event => {
    await aria2RPC.message('aria2.changeOption', [activeId, {'all-proxy': aria2Store['proxy_server']}]);
    event.target.parentNode.querySelector('input').value = aria2Store['proxy_server'];
});

document.querySelector('#append button').addEventListener('click', async event => {
    await aria2RPC.message('aria2.changeUri', [activeId, 1, [], [document.querySelector('#append input').value]]);
    document.querySelector('#append input').value = '';
});

http.addEventListener('click', event => {
    event.ctrlKey ? aria2RPC.message('aria2.changeUri', [activeId, 1, [event.target.innerText], []]) : navigator.clipboard.writeText(event.target.innerText);
});

bt.addEventListener('click', async event => {
    if (event.target.id === 'index') {
        var index = fileManager.indexOf(event.target.innerText);
        var files = index !== -1 ? [...fileManager.slice(0, index), ...fileManager.slice(index + 1)] : [...fileManager, event.target.innerText];
        await aria2RPC.message('aria2.changeOption', [activeId, {'select-file': files.join()}]);
        fileManager = files;
    }
});

function aria2RPCClient() {
    activeTask = [];
    waitingTask = [];
    stoppedTask = [];
    aria2RPC.message('aria2.getGlobalStat').then(async ({numActive, numWaiting, numStopped}) => {
        updateManager();
        aria2RPC.message('aria2.tellWaiting', [0, numWaiting | 0]).then(waiting => waiting.forEach(result => printSession(result, waitingQueue, waitingTask)));
        aria2RPC.message('aria2.tellStopped', [0, numStopped | 0]).then(stopped => stopped.forEach(result => printSession(result, stoppedQueue, stoppedTask)));        
        activeStat.innerText = numActive;
        waitingStat.innerText = numWaiting;
        stoppedStat.innerText = numStopped;
        aria2Socket = new WebSocket(aria2Store['jsonrpc_uri'].replace('http', 'ws'));
        aria2Socket.onmessage = async event => {
            var {method, params: [{gid}]} = JSON.parse(event.data);
            if (method !== 'aria2.onBtDownloadComplete') {
                if (method === 'aria2.onDownloadStart') {
                    if (activeTask.indexOf(gid) === -1) {
                        addSession('active', gid);
                        waitingTask.includes(gid) ? removeSession('waiting', gid) :
                        stoppedTask.includes(gid) ? removeSession('stopped', gid) : null;
                    }
                }
                else {
                    removeSession('active', gid);
                    method === 'aria2.onDownloadPause' ? addSession('waiting', gid) : addSession('stopped', gid);
                }
            }
        };
        aria2Alive = setInterval(() => aria2RPC.message('aria2.tellActive').then(updateManager), aria2Store['refresh_interval']);
    }).catch(error => {
        activeQueue.innerHTML = waitingQueue.innerHTML = stoppedQueue.innerHTML = '';
    });
}

async function addSession(type, gid) {
    var result = await aria2RPC.message('aria2.tellStatus', [gid]);
    var task = printSession(result);
    self[type + 'Stat'].innerText ++;
    self[type + 'Task'].push(gid);
    self[type + 'Queue'].append(task);
}

function removeSession(type, gid, task) {
    self[type + 'Stat'].innerText --;
    self[type + 'Task'].splice(self[type + 'Task'].indexOf(gid), 1);
    task && task.remove();
}

async function updateManager() {
    var download = 0;
    var upload = 0;
    var active = await aria2RPC.message('aria2.tellActive');
    active.forEach(result => {
        printSession(result, activeQueue, activeTask);
        download += result.downloadSpeed | 0;
        upload += result.uploadSpeed | 0;
    });
    downloadStat.innerText = getFileSize(download) + '/s';
    uploadStat.innerText = getFileSize(upload) + '/s';
    aria2Alive = setTimeout(updateManager, aria2Store['refresh_interval']);
}

function printSession({gid, status, files, bittorrent, completedLength, totalLength, downloadSpeed, uploadSpeed, connections, numSeeders}, queue, array) {
    var task = document.querySelector('[data-gid="' + gid + '"]') ?? parseSession(gid, bittorrent, queue, array);
    task.setAttribute('status', status);
    task.querySelector('#name').innerText = bittorrent ? bittorrent.info ? bittorrent.info.name : files[0].path : files[0].path ? files[0].path.slice(files[0].path.lastIndexOf('/') + 1) : files[0].uris[0].uri;
    task.querySelector('#local').innerText = getFileSize(completedLength);
    task.querySelector('#remote').innerText = getFileSize(totalLength);
    task.querySelector('#infinite').style.display = totalLength === completedLength || downloadSpeed === '0' ? 'inline-block' : printEstimatedTime(task, (totalLength - completedLength) / downloadSpeed) ?? 'none';
    task.querySelector('#connect').innerText = bittorrent ? numSeeders + ' (' + connections + ')' : connections;
    task.querySelector('#download').innerText = getFileSize(downloadSpeed) + '/s';
    task.querySelector('#upload').innerText = getFileSize(uploadSpeed) + '/s';
    task.querySelector('#ratio').innerText = task.querySelector('#ratio').style.width = ((completedLength / totalLength * 10000 | 0) / 100) + '%';
    task.querySelector('#ratio').className = status;
    task.querySelector('#retry_btn').style.display = !bittorrent && ['error', 'removed'].includes(status) ? 'inline-block' : 'none';
    activeId === gid && updateTaskDetail(task, status, bittorrent, files);
    return task;
}

function parseSession(gid, bittorrent, queue, array) {
    var task = document.querySelector('[data-gid="template"]').cloneNode(true);
    array && array.push(gid);
    queue && queue.append(task);
    task.setAttribute('data-gid', gid);;
    task.querySelector('#upload').parentNode.style.display = bittorrent ? 'inline-block' : 'none';
    task.querySelector('#remove_btn').addEventListener('click', async event => {
        var status = task.getAttribute('status');
        var method = ['active', 'waiting', 'paused'].includes(status) ? 'aria2.forceRemove' : 'aria2.removeDownloadResult';
        await aria2RPC.message(method, [gid]);
        ['complete', 'error', 'removed'].includes(status) ? removeSession('stopped', gid, task) :
        status === 'paused' ? removeSession('waiting', gid, task) : null;
    });
    task.querySelector('#invest_btn').addEventListener('click', async event => {
        activeId = gid;
        fileManager = [];
        var {status, bittorrent, files} = await aria2RPC.message('aria2.tellStatus', [gid]);
        var options = await aria2RPC.message('aria2.getOption', [gid]);
        printOptions(document.querySelectorAll('#manager [name]'), options);
        updateTaskDetail(task, status, bittorrent, files);
        document.body.setAttribute('data-popup', 'aria2');
        document.querySelector('#manager').setAttribute('data-aria2', bittorrent ? 'bt' : 'http');
        document.querySelector('#manager #remote').innerText = task.querySelector('#remote').innerText;
    });
    task.querySelector('#retry_btn').addEventListener('click', async event => {
        var {files: [{path, uris}]} = await aria2RPC.message('aria2.tellStatus', [gid]);
        var options = await aria2RPC.message('aria2.getOption', [gid]);
        options['out'] = path ? path.slice(path.lastIndexOf('/') + 1) : '';
        await aria2RPC.message('aria2.addUri', [uris.map(({uri}) => uri), options]);
        await aria2RPC.message('aria2.removeDownloadResult', [gid]);
        removeSession('stopped', gid, task);
    });
    task.querySelector('#meter').addEventListener('click', event => {
        var status = task.getAttribute('status');
        ['active', 'waiting'].includes(status) ? aria2RPC.message('aria2.forcePause', [gid]) :
        status === 'paused' ? aria2RPC.message('aria2.unpause', [gid]) : null;
    });
    return task;
}

function printEstimatedTime(task, number) {
    var days = number / 86400 | 0;
    var hours = number / 3600 - days * 24 | 0;
    var minutes = number / 60 - days * 1440 - hours * 60 | 0;
    var seconds = number - days * 86400 - hours * 3600 - minutes * 60 | 0;
    task.querySelector('#day').innerText = days;
    task.querySelector('#day').parentNode.style.display = days > 0 ? 'inline-block' : 'none';
    task.querySelector('#hour').innerText = hours;
    task.querySelector('#hour').parentNode.style.display = hours > 0 ? 'inline-block' : 'none';
    task.querySelector('#minute').innerText = minutes;
    task.querySelector('#minute').parentNode.style.display = minutes > 0 ? 'inline-block' : 'none';
    task.querySelector('#second').innerText = seconds;
}

function createOptions() {
    var options = {'referer': document.querySelector('#referer').value, 'user-agent': aria2Store['user_agent']};
    document.querySelectorAll('#create input[name]').forEach(field => options[field.name] = field.value);
    return options;
}

function updateTaskDetail(task, status, bittorrent, files) {
    var disabled = ['complete', 'error', 'removed'].includes(status);
    document.querySelector('#name_btn').innerText = task.querySelector('#name').innerText;
    document.querySelector('#name_btn').className = task.querySelector('#ratio').className;
    document.querySelector('#manager #local').innerText = task.querySelector('#local').innerText;
    document.querySelector('#manager #ratio').innerText = task.querySelector('#ratio').innerText;
    document.querySelector('#manager #download').innerText = task.querySelector('#download').innerText;
    document.querySelector('#manager #upload').innerText = task.querySelector('#upload').innerText;
    document.querySelector('#manager [name="max-download-limit"]').disabled = disabled;
    document.querySelector('#manager [name="max-upload-limit"]').disabled = disabled || !bittorrent;
    document.querySelector('#manager [name="all-proxy"]').disabled = disabled;
    bittorrent ? printTaskFiles(bt, files) : printTaskUris(http, files[0].uris);
}

function printTableCell(table, type, resolve) {
    var cell = document.querySelector('[data-' + type + '="template"]').cloneNode(true);
    cell.removeAttribute('data-' + type);
    typeof resolve === 'function' && resolve(cell);
    table.append(cell);
    return cell;
}

function printTaskUris(table, uris) {
    var cells = table.querySelectorAll('button');
    uris.forEach(({uri, status}, index) => {
        var cell = cells[index] ?? printTableCell(table, 'uri');
        cell.innerText = uri;
        cell.className = status === 'used' ? 'active' : 'waiting';
    });
    cells.forEach((cell, index) => index > uris.length && cell.remove());
}

function printTaskFiles(table, files) {
    var cells = table.querySelectorAll('.file');
    files.forEach(({index, selected, path, length, completedLength}, at) => {
        var cell = cells[at] ?? printTableCell(table, 'file', cell => {
            cell.querySelector('#index').innerText = index;
            cell.querySelector('#name').innerText = path.slice(path.lastIndexOf('/') + 1);
            cell.querySelector('#name').title = path;
            cell.querySelector('#size').innerText = getFileSize(length);
            selected === 'true' && fileManager.push(index);
        });
        cell.querySelector('#index').className = selected === 'true' ? 'active' : 'error';
        cell.querySelector('#ratio').innerText = ((completedLength / length * 10000 | 0) / 100) + '%';
    });
}
