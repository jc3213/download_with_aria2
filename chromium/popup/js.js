var activeStat = document.querySelector('[data-stat="active"]');
var waitingStat = document.querySelector('[data-stat="waiting"]');
var stoppedStat = document.querySelector('[data-stat="stopped"]');
var downloadStat = document.querySelector('[data-stat="download"] > span');
var uploadStat = document.querySelector('[data-stat="upload"] > span');
var activeQueue = document.querySelector('[data-queue="active"]');
var waitingQueue = document.querySelector('[data-queue="waiting"]');
var pausedQueue = document.querySelector('[data-queue="paused"]');
var completeQueue = document.querySelector('[data-queue="complete"]');
var removedQueue = document.querySelector('[data-queue="removed"]');
var errorQueue = document.querySelector('[data-queue="error"]');
var sessionLET = document.querySelector('div.session');
var referer = document.querySelector('#referer');
var useragent = document.querySelector('#useragent');
var batch = document.querySelector('#batch');
var entries = document.querySelector('#entries');
var activeId;
var fileLET = document.querySelector('div.file');
var uriLET = document.querySelector('div.uri');
var fileList = document.querySelector('#files');
var uriList = document.querySelector('#uris');

var savebtn = document.querySelector('#save_btn');

document.querySelectorAll('button[class]:not(:disabled)').forEach((tab, index) => {
    tab.addEventListener('click', event => {
        var value = tab.parentNode.getAttribute('data-main') == index ? 3 : index;
        tab.parentNode.setAttribute('data-main', value);
        document.querySelector('#session').setAttribute('data-main', value);
    });
});

document.querySelector('#download_btn').addEventListener('click', async event => {
    var options = await aria2RPC.message('aria2.getGlobalOption');
    printGlobalOptions(options, '#download input[name]');
    document.body.setAttribute('data-popup', 'task');
    useragent.value = aria2Store['user_agent'];
    batch.value = '0';
    referer.value = entries.value = '';
});

document.querySelector('#purge_btn').addEventListener('click', async event => {
    await aria2RPC.message('aria2.purgeDownloadResult');
    completeQueue.innerHTML = removedQueue.innerHTML = errorQueue.innerHTML = '';
    stoppedStat.innerText = '0';
});

document.querySelector('#options_btn').addEventListener('click', event => {
    chrome.runtime.openOptionsPage();
});

document.querySelector('#referer_btn').addEventListener('click', async event => {
    referer.value = await getCurrentTabUrl();
});

document.querySelector('#proxy_new').addEventListener('click', event => {
    event.target.parentNode.querySelector('input').value = aria2Store['proxy_server'];
});

document.querySelector('#submit_btn').addEventListener('click', event => {
    var options = downloadOptions();
    if (batch.value === '0') {
        var urls = entries.value.match(/(https?:\/\/|ftp:\/\/|magnet:\?)[^\s\n]+/g);
        if (urls) {
            urls.forEach(url => downloadUrl(url, options));
        }
    }
    else if (batch.value === '1') {
        var json = new Blob([entries.value], {type: 'application/json;charset=utf-8'});
        downloadJSON(json, options);
    }
    else if (batch.value === '2') {
        var metalink = new Blob([entries.value], {type: 'application/metalink;charset=utf-8'});
        downloadMetalink(metalink, options);
    }
    document.body.setAttribute('data-popup', 'main');
});

document.querySelector('#upload_btn').style.display = 'browser' in this ? 'none' : 'inline-block';
document.querySelector('#upload_btn').addEventListener('change', async event => {
    var file = event.target.files[0];
    var options = downloadOptions();
    if (file.name.endsWith('torrent')){
        await downloadTorrent(file, options);
    }
    else if (file.name.endsWith('json')) {
        await downloadJSON(file, options);
    }
    else {
        await downloadMetalink(file, options);
    }
    aria2WhenStart(file.name);
    event.target.value = '';
    document.body.setAttribute('data-popup', 'main');
});

function downloadOptions() {
    var options = {'referer': referer.value, 'user-agent': useragent.value};
    document.querySelectorAll('#download input[name]').forEach(field => options[field.name] = field.value);
    return options;
}

async function downloadUrl(url, options) {
    var gid = await aria2RPC.message('aria2.addUri', [[url], options]);
    addSession(gid);
    aria2WhenStart(url);
}

async function downloadJSON(file, options) {
    var json = await readFileTypeJSON(file);
    if (Array.isArray(json)) {
        json.forEach(jn => parseJSON(jn, options));
    }
    else {
        parseJSON(json, options);
    }
}

async function parseJSON(json, extras) {
    var {url, options} = json;
    if (options) {
        options = {...extras, ...options};
    }
    else {
        options = extras;
    }
    await downloadUrl(url, options);
}

async function downloadTorrent(file, options) {
    var torrent = await readFileForAria2(file);
    var gid = await aria2RPC.message('aria2.addTorrent', [torrent]);
    addSession(gid);
}

async function downloadMetalink(file, options) {
    var metalink = await readFileForAria2(file);
    await aria2RPC.message('aria2.addMetalink', [metalink, options]);
    aria2RPC.message('aria2.tellWaiting', [0, 999]).then(waiting => waiting.forEach(printSession));
}

document.querySelector('#name_btn').addEventListener('click', event => {
    activeId = fileList.innerHTML = uriList.innerHTML = '';
    savebtn.style.display = 'none';
    document.body.setAttribute('data-popup', 'main');
});

document.querySelector('#manager').addEventListener('change', event => {
    var {name, value} = event.target;
    aria2RPC.message('aria2.changeOption', [activeId, {[name]: value}]);
});

document.querySelectorAll('.active.float, .complete.float').forEach(block => {
    var field = block.parentNode.querySelector('input');
    block.addEventListener('click', event => {
        if (field.disabled) {
            return;
        }
        block.style.display = 'none';
        field.focus();
    });
    field.addEventListener('blur', event => {
        block.style.display = 'block';
    });
});

document.querySelector('#proxy_mgr').addEventListener('click', async event => {
    await aria2RPC.message('aria2.changeOption', [activeId, {'all-proxy': aria2Store['proxy_server']}]);
    event.target.parentNode.querySelector('input').value = aria2Store['proxy_server'];
});

document.querySelector('#append_btn').addEventListener('click', async event => {
    var uri = event.target.parentNode.querySelector('input');
    await aria2RPC.message('aria2.changeUri', [activeId, 1, [], [uri.value]]);
    uri.value = '';
});

savebtn.addEventListener('click', async event => {
    var files = [];
    fileList.querySelectorAll('#index').forEach(index => {
        if (index.className === 'active') {
            files.push(index.innerText);
        }
    });
    await aria2RPC.message('aria2.changeOption', [activeId, {'select-file': files.join()}]);
    savebtn.style.display = 'none';
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
    var type = status === 'active' ? 'active' : 'waiting,paused'.includes(status) ? 'waiting' : 'stopped';
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
}

function printSession({gid, status, files, bittorrent, completedLength, totalLength, downloadSpeed, uploadSpeed, connections, numSeeders}) {
    var task = document.getElementById(gid) ?? parseSession(gid, status, bittorrent);
    var time = (totalLength - completedLength) / downloadSpeed;
    var ratio = (completedLength / totalLength * 10000 | 0) / 100;
    task.setAttribute('status', status);
    task.querySelector('#name').innerText = getDownloadName(bittorrent, files);
    task.querySelector('#local').innerText = getFileSize(completedLength);
    task.querySelector('#remote').innerText = getFileSize(totalLength);
    if (isNaN(time)) {
        task.querySelector('#infinite').style.display = 'block';
    }
    else {
        var days = time / 86400 | 0;
        var hours = time / 3600 - days * 24 | 0;
        var minutes = time / 60 - days * 1440 - hours * 60 | 0;
        var seconds = time - days * 86400 - hours * 3600 - minutes * 60 | 0;
        printEstimateTime(task.querySelector('#day'), days);
        printEstimateTime(task.querySelector('#hour'), hours);
        printEstimateTime(task.querySelector('#minute'), minutes);
        task.querySelector('#second').innerText = seconds;
    }
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
    var type = status === 'active' ? 'active' : 'waiting,paused'.includes(status) ? 'waiting' : 'stopped';
    self[type + 'Stat'].innerText ++;
    self[type + 'Task'].push(gid);
    self[status + 'Queue'].appendChild(task);
    task.id = gid;
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
        activeId = gid;
        var {status, bittorrent, files} = await aria2RPC.message('aria2.tellStatus', [gid]);
        var options = await aria2RPC.message('aria2.getOption', [gid]);
        printGlobalOptions(options, '#manager [name]');
        updateTaskDetail(task, status, bittorrent, files);
        document.body.setAttribute('data-popup', 'aria2');
        document.querySelector('#manager').setAttribute('data-aria2', bittorrent ? 'bt' : 'http');
        document.querySelector('#manager #remote').innerText = task.querySelector('#remote').innerText;
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
    return task;
}

function updateTaskDetail(task, status, bittorrent, files) {
    var disabled = 'complete,error,removed'.includes(status);
    document.querySelector('#name_btn').innerText = task.querySelector('#name').innerText;
    document.querySelector('#name_btn').className = task.querySelector('#ratio').className;
    document.querySelector('#manager #local').innerText = task.querySelector('#local').innerText;
    document.querySelector('#manager #ratio').innerText = task.querySelector('#ratio').innerText;
    document.querySelector('#manager #download').innerText = task.querySelector('#download').innerText;
    document.querySelector('#manager #upload').innerText = task.querySelector('#upload').innerText;
    document.querySelector('#manager [name="max-download-limit"]').disabled = disabled;
    document.querySelector('#manager [name="max-upload-limit"]').disabled = disabled || !bittorrent;
    document.querySelector('#manager [name="all-proxy"]').disabled = disabled;
    printTaskFiles(files);
}

function printTableCell(table, template, runOnce) {
    var cell = template.cloneNode(true);
    runOnce(cell);
    table.appendChild(cell);
    return cell;
}

function printTaskFiles(files) {
    var cells = fileList.childNodes;
    files.forEach((file, index) => {
        var cell = cells[index] ?? printTableCell(fileList, fileLET, cell => applyFileSelect(cell, file));
        var {length, completedLength} = file;
        cell.querySelector('#ratio').innerText = ((completedLength / length * 10000 | 0) / 100) + '%';
    });
}

function applyFileSelect(cell, {index, path, length, selected, uris}) {
    var tile = cell.querySelector('#index');
    tile.innerText = index;
    tile.className = selected === 'true' ? 'active' : 'error';
    cell.querySelector('#name').innerText = path.slice(path.lastIndexOf('/') + 1);
    cell.querySelector('#name').title = path;
    cell.querySelector('#size').innerText = getFileSize(length);
    if (uris.length === 0) {
        tile.addEventListener('click', event => {
            tile.className = tile.className === 'active' ? 'error' : 'active';
            savebtn.style.display = 'inline-block';
        });
    }
    else {
        printTaskUris(uris);
    }
}

function printTaskUris(uris) {
    var cells = uriList.childNodes;
    var index = -1;
    var used;
    var wait;
    uris.forEach(({uri, status}) => {
        var cell = cells[index] ?? printTableCell(uriList, uriLET, applyUriChange);
        var link = cell.querySelector('#uri');
        if (link.innerText !== uri) {
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

function applyUriChange(cell) {
    cell.addEventListener('click', event => {
        var uri = cell.querySelector('#uri').innerText;
        if (event.ctrlKey) {
            aria2RPC.message('aria2.changeUri', [activeId, 1, [uri], []]);
        }
        else {
           navigator.clipboard.writeText(uri);
        }
    });
}
