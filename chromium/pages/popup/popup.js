var queuebtn = document.querySelector('#queue_btn');
var chooseQueue = document.querySelector('#choose');
var activeStat = document.querySelector('#status #active');
var waitingStat = document.querySelector('#status #waiting');
var stoppedStat = document.querySelector('#status #stopped');
var downloadStat = document.querySelector('#status #download');
var uploadStat = document.querySelector('#status #upload');
var activeQueue = document.querySelector('#queue > #active');
var waitingQueue = document.querySelector('#queue > #waiting');
var pausedQueue = document.querySelector('#queue > #paused');
var completeQueue = document.querySelector('#queue > #complete');
var removedQueue = document.querySelector('#queue > #removed');
var errorQueue = document.querySelector('#queue > #error');
var sessionLET = document.querySelector('.template > .session');
var fileLET = document.querySelector('.template > .file');
var uriLET = document.querySelector('.template > .uri');
var detailed;

chooseQueue.querySelectorAll('div').forEach((node) => {
    var {body} = document;
    var {id} = node;
    node.addEventListener('click', event => {
        body.classList.toggle(id);
    });
});

queuebtn.addEventListener('click', (event) => {
    document.body.classList.toggle('queue');
});

document.querySelector('#purge_btn').addEventListener('click', async (event) => {
    await aria2RPC.call('aria2.purgeDownloadResult');
    completeQueue.innerHTML = removedQueue.innerHTML = errorQueue.innerHTML = '';
    stoppedStat.innerText = '0';
});

function aria2StartUp() {
    activeTask = [];
    waitingTask = [];
    stoppedTask = [];
    aria2RPC.batch([
        {method: 'aria2.getGlobalStat'},
        {method: 'aria2.tellActive'},
        {method: 'aria2.tellWaiting', params: [0, 999]},
        {method: 'aria2.tellStopped', params: [0, 999]}
    ]).then(([{downloadSpeed, uploadSpeed}, active, waiting, stopped]) => {
        [...active, ...waiting, ...stopped].forEach(printSession);
        downloadStat.innerText = getFileSize(downloadSpeed);
        uploadStat.innerText = getFileSize(uploadSpeed);
        aria2Client();
    }).catch(error => {
        activeStat.innertext = waitingStat.innerText = stoppedStat.innerText = downloadStat.innerText = uploadStat.innerText = '0';
        activeQueue.innerHTML = waitingQueue.innerHTML = pausedQueue.innerHTML = completeQueue.innerHTML = removedQueue.innerHTML = errorQueue.innerHTML = '';
    });
}

function aria2Client() {
    aria2Alive = setInterval(updateManager, aria2Store['manager_interval']);
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
    var [{downloadSpeed, uploadSpeed}, active] = await aria2RPC.batch([
        {method: 'aria2.getGlobalStat'},
        {method: 'aria2.tellActive'}
    ]);
    active.forEach(printSession);
    downloadStat.innerText = getFileSize(downloadSpeed);
    uploadStat.innerText = getFileSize(uploadSpeed);
}

function updateSession(task, gid, status) {
    var cate = status === 'active' ? 'active' : 'waiting,paused'.includes(status) ? 'waiting' : 'stopped';
    if (self[cate + 'Task'].indexOf(gid) === -1) {
        self[cate + 'Task'].push(gid);
        self[cate + 'Stat'].innerText ++;
    }
    self[status + 'Queue'].appendChild(task);
    task.cate = cate;
}

async function addSession(gid) {
    var result = await aria2RPC.call('aria2.tellStatus', [gid]);
    var task = printSession(result);
    var {status} = result;
    updateSession(task, gid, status);
}

function removeSession(cate, gid, task) {
    self[cate + 'Stat'].innerText --;
    self[cate + 'Task'].splice(self[cate + 'Task'].indexOf(gid), 1);
    task?.remove();
}

function printSession({gid, status, files, bittorrent, completedLength, totalLength, downloadSpeed, uploadSpeed, connections, numSeeders}) {
    var task = document.getElementById(gid) ?? parseSession(gid, status, bittorrent);
    task.querySelector('#title').innerText = getDownloadName(gid, bittorrent, files);
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
    if (detailed === task) {
        printTaskFileList(files);
    }
    return task;
}

function parseSession(gid, status, bittorrent) {
    var task = sessionLET.cloneNode(true);
    task.id = gid;
    task.classList.add(bittorrent ? 'p2p' : 'http');
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
    task.querySelector('#detail_btn').addEventListener('click', async event => {
        closeTaskDetail();
        if (detailed === task) {
            detailed = null;
        }
        else {
            var [files, options] = await getTaskDetail(gid);
            task.querySelectorAll('[id]').disposition(options);
            detailed = task;
            printTaskFileList(files);
            task.classList.add('extra');
        }
    });
    task.querySelector('#retry_btn').addEventListener('click', async event => {
        var [files, options] = await getTaskDetail(gid);
        var {uris, path} = files[0];
        var url = [...new Set(uris.map(({uri}) => uri))];
        if (path) {
            var ni = path.lastIndexOf('/');
            options['dir'] = path.slice(0, ni);
            options['out'] = path.slice(ni + 1);
        }
        var [id] = await aria2RPC.batch([
            {method: 'aria2.addUri', params: [url, options]},
            {method: 'aria2.removeDownloadResult', params: [gid]}
        ]);
        addSession(id);
        removeSession('stopped', gid, task);
    });
    task.querySelector('#meter').addEventListener('click', async event => {
        var status = task.parentNode.className;
        if ('active,waiting'.includes(status)) {
            await aria2RPC.call('aria2.forcePause', [gid]);
            pausedQueue.appendChild(task);
        }
        else if (status === 'paused') {
            await aria2RPC.call('aria2.unpause', [gid]);
            waitingQueue.appendChild(task);
        }
    });
    task.querySelector('#options').addEventListener('change', event => {
        var {id, value} = event.target;
        aria2RPC.call('aria2.changeOption', [gid, {[id]: value}]);
    });
    task.querySelector('#proxy_btn').addEventListener('click', async event => {
        await aria2RPC.call('aria2.changeOption', [gid, {'all-proxy': aria2Store['proxy_server']}]);
        event.target.previousElementSibling.value = aria2Store['proxy_server'];
    });
    task.querySelector('#save_btn').addEventListener('click', async event => {
        var files = [...task.querySelectorAll('#index.ready')].map(index => index.innerText);
        await aria2RPC.call('aria2.changeOption', [gid, {'select-file': files.join()}]);
        event.target.style.display = 'none';
    });
    task.querySelector('#append_btn').addEventListener('click', async event => {
        var uri = event.target.previousElementSibling;
        await aria2RPC.call('aria2.changeUri', [gid, 1, [], [uri.value]]);
        uri.value = '';
    });
    updateSession(task, gid, status);
    return task;
}

function getTaskDetail(gid) {
    return aria2RPC.batch([
        {method: 'aria2.getFiles', params: [gid]},
        {method: 'aria2.getOption', params: [gid]}
    ]);
}

function closeTaskDetail() {
    if (detailed) {
        detailed.classList.remove('extra');
        detailed.querySelector('#files').innerHTML = detailed.querySelector('#uris').innerHTML = '';
        detailed.querySelector('#save_btn').style.display = 'none';
    }
}

function printFileItem(list, index, path, length, selected, uris) {
    var item = fileLET.cloneNode(true);
    var push = uris.length === 0;
    var tile = item.querySelector('#index');
    tile.innerText = index;
    tile.className = selected === 'true' ? 'ready' : '';
    tile.addEventListener('click', event => {
        if (detailed.cate !== 'stopped' && push) {
            tile.className = tile.className === 'ready' ? '' : 'ready';
            detailed.querySelector('#save_btn').style.display = 'block';
        }
    });
    item.querySelector('#name').innerText = path.slice(path.lastIndexOf('/') + 1);
    item.querySelector('#name').title = path;
    item.querySelector('#size').innerText = getFileSize(length);
    list.appendChild(item);
    return item;
}

function printTaskFileList(files) {
    var fileList = detailed.querySelector('#files');
    var items = [...fileList.childNodes];
    files.forEach(({index, path, length, selected, completedLength, uris}, step) => {
        var item = items[step] ?? printFileItem(fileList, index, path, length, selected, uris);
        item.querySelector('#ratio').innerText = (completedLength / length * 10000 | 0) / 100;
        if (uris.length !== 0) {
            printTaskUriList(uris);
        }
    });
}

function printUriItem(list, uri) {
    var item = uriLET.cloneNode(true);
    item.addEventListener('click', event => {
        if (event.ctrlKey) {
            aria2RPC.call('aria2.changeUri', [detailed.id, 1, [uri], []]);
        }
        else {
           navigator.clipboard.writeText(uri);
        }
    });
    list.appendChild(item);
    return item;
}

function printTaskUriList(uris) {
    var uriList = detailed.querySelector('#uris');
    var items = [...uriList.childNodes];
    var all = items.length;
    var result = {};
    var urls = [];
    uris.forEach(({uri, status}) => {
        var it = result[uri];
        var used = it?.used ?? 0;
        var wait = it?.wait ?? 0;
        if (!it) {
            urls.push(uri);
        }
        status === 'used' ? used ++ : wait ++;
        result[uri] = {used, wait};
    });
    urls.forEach((uri, step) => {
        var item = items[step] ?? printUriItem(uriList, uri);
        var {used, wait} = result[uri];
        item.querySelector('#uri').innerText = uri;
        item.querySelector('#used').innerText = used;
        item.querySelector('#wait').innerText = wait;
    });
    items.slice(urls.length).forEach(item => item.remove());
}
