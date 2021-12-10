var activeQueue = document.querySelector('[queue="active"]');
var waitingQueue = document.querySelector('[queue="waiting"]');
var stoppedQueue = document.querySelector('[queue="stopped"]');

document.querySelectorAll('[tab]').forEach(tab => {
    var active = tab.getAttribute('tab');
    tab.addEventListener('click', event => {
        document.querySelectorAll('[queue]').forEach(queue => {
            var id = queue.getAttribute('queue');
            tab.classList.contains('checked') ? queue.style.display = 'block' :
                id === active ? queue.style.display = 'block' :
                queue.style.display = document.querySelector('[tab="' + id + '"]').classList.remove('checked') ?? 'none';
        });
        tab.classList.toggle('checked');
    });
});

document.querySelectorAll('[module]').forEach(module => {
    var id = module.getAttribute('module');
    var url = module.getAttribute('link') + '?popup';
    module.addEventListener('click', event => {
        event.target.classList.contains('checked') ? document.getElementById(id).remove() : openModuleWindow(id, url);
        module.classList.toggle('checked');
    });
});

document.querySelector('#purdge_btn').addEventListener('click', event => {
    aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.purgeDownloadResult', params: [aria2RPC.jsonrpc['token']]},
    result => {
        activeQueue.innerHTML = waitingQueue.innerHTML = stoppedQueue.innerHTML = '';
        aria2RPCRefresh();
    });
});

function aria2RPCClient() {
    document.querySelector('#caution').style.display = 'none';
    document.querySelector('#menus').style.display = 'block';
    aria2RPCRequest([
        {id: '', jsonrpc: 2, method: 'aria2.getGlobalStat', params: [aria2RPC.jsonrpc['token']]},
        {id: '', jsonrpc: 2, method: 'aria2.tellActive', params: [aria2RPC.jsonrpc['token']]},
        {id: '', jsonrpc: 2, method: 'aria2.tellWaiting', params: [aria2RPC.jsonrpc['token'], 0, 999]},
        {id: '', jsonrpc: 2, method: 'aria2.tellStopped', params: [aria2RPC.jsonrpc['token'], 0, 999]}
    ], (global, active, waiting, stopped) => {
        document.querySelector('#active').innerText = global.numActive;
        document.querySelector('#waiting').innerText = global.numWaiting;
        document.querySelector('#stopped').innerText = global.numStopped;
        document.querySelector('#download').innerText = bytesToFileSize(global.downloadSpeed) + '/s';
        document.querySelector('#upload').innerText = bytesToFileSize(global.uploadSpeed) + '/s';
        active.forEach((active, index) => printTaskDetails(active, index, activeQueue));
        waiting.forEach((waiting, index) => printTaskDetails(waiting, index, waitingQueue));
        stopped.forEach((stopped, index) => printTaskDetails(stopped, index, stoppedQueue));
    }, error => {
        clearTimeout(aria2KeepAlive);
        document.querySelector('#menus').style.display = 'none';
        document.querySelector('#caution').innerText = error;
        document.querySelector('#caution').style.display = 'block';
        document.querySelectorAll('iframes').forEach(iframe => iframe.id !== 'options' ? iframe.remove() : null);
        activeQueue.innerHTML = waitingQueue.innerHTML = stoppedQueue.innerHTML = '';
    }, true);
}

function printTaskDetails(result, index, queue) {
    var task = document.getElementById(result.gid) ?? createTaskList(result);
    if (task.parentNode !== queue) {
        queue.insertBefore(task, queue.childNodes[index]);
        task.setAttribute('status', result.status);
        if (['complete', 'waiting', 'removed', 'error'].includes(result.status)) {
            updateTaskDetails(task, result);
        }
    }
    if (!['complete', 'waiting', 'removed', 'error'].includes(result.status)) {
        updateTaskDetails(task, result);
    }
}

function updateTaskDetails(task, result) {
    task.querySelector('#name').innerText = result.bittorrent && result.bittorrent.info ? result.bittorrent.info.name : result.files[0].path ? result.files[0].path.slice(result.files[0].path.lastIndexOf('/') + 1) : result.files[0].uris[0] ? result.files[0].uris[0].uri : result.gid;
    task.querySelector('#error').innerText = result.errorMessage ?? '';
    task.querySelector('#local').innerText = bytesToFileSize(result.completedLength);
    calcEstimatedTime(task, (result.totalLength - result.completedLength) / result.downloadSpeed);
    task.querySelector('#connect').innerText = result.bittorrent ? result.numSeeders + ' (' + result.connections + ')' : result.connections;
    task.querySelector('#download').innerText = bytesToFileSize(result.downloadSpeed) + '/s';
    task.querySelector('#upload').innerText = bytesToFileSize(result.uploadSpeed) + '/s';
    task.querySelector('#ratio').innerText = task.querySelector('#ratio').style.width = ((result.completedLength / result.totalLength * 10000 | 0) / 100) + '%';
    task.querySelector('#ratio').className = result.status;
    task.querySelector('#retry_btn').style.display = !result.bittorrent && ['error', 'removed'].includes(result.status) ? 'inline-block' : 'none';
}

function createTaskList(result) {
    var task = document.querySelector('#template').cloneNode(true);
    var gid = result.gid;
    task.id = gid;
    task.querySelector('#remote').innerText = bytesToFileSize(result.totalLength);
    task.querySelector('#upload').parentNode.style.display = result.bittorrent ? 'inline-block' : 'none';
    updateTaskDetails(task, result);
    task.querySelector('#remove_btn').addEventListener('click', event => {
        var status = task.getAttribute('status');
        aria2RPCRequest({id: '', jsonrpc: 2, method: ['active', 'waiting', 'paused'].includes(status) ? 'aria2.forceRemove' : 'aria2.removeDownloadResult', params: [aria2RPC.jsonrpc['token'], gid]},
        result => ['complete', 'error', 'paused', 'removed'].includes(status) ? task.remove() : task.querySelector('#ratio').innerText === '100%' ? task.querySelector('#ratio').className = task.setAttribute('status', 'complete') ?? 'complete' : task.setAttribute('status', 'removed'),
        error => task.remove());
    });
    task.querySelector('#invest_btn').addEventListener('click', event => openModuleWindow('taskMgr', 'task/index.html?' + (result.bittorrent ? 'bt' : 'http') + '#' + gid));
    task.querySelector('#retry_btn').addEventListener('click', event => {
        aria2RPCRequest([
            {id: '', jsonrpc: 2, method: 'aria2.getFiles', params: [aria2RPC.jsonrpc['token'], gid]},
            {id: '', jsonrpc: 2, method: 'aria2.getOption', params: [aria2RPC.jsonrpc['token'], gid]},
            {id: '', jsonrpc: 2, method: 'aria2.removeDownloadResult', params: [aria2RPC.jsonrpc['token'], gid]}
        ], (files, options) => {
            aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.addUri', params: [aria2RPC.jsonrpc['token'], files[0].uris.map(({uri}) => uri), options]},
            result => task.remove());
        });
    });
    task.querySelector('#fancybar').addEventListener('click', event => {
        var status = task.getAttribute('status');
        var method = ['active', 'waiting'].includes(status) ? 'aria2.pause' : status === 'paused' ? 'aria2.unpause' : null;
        if (method) {
            aria2RPCRequest({id: '', jsonrpc: 2, method, params: [aria2RPC.jsonrpc['token'], gid]},
            result => task.setAttribute('status', method === 'aria2.pause' ? 'paused' : 'active'));
        }
    });
    return task;
}

function calcEstimatedTime(task, number) {
    if (isNaN(number) || number === Infinity) {
        task.querySelector('#infinite').style.display = 'inline-block';
        task.querySelector('#estimate').style.display = 'none';
    }
    else {
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
        task.querySelector('#infinite').style.display = 'none';
        task.querySelector('#estimate').style.display = 'inline-block';
    }
}
