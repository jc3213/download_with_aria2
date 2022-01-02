var activeQueue = document.querySelector('.queue > #active');
var waitingQueue = document.querySelector('.queue > #waiting');
var stoppedQueue = document.querySelector('.queue > #stopped');
var currentTab = -1;

document.querySelectorAll('[tab]').forEach((tab, index, tabs) => {
    tab.addEventListener('click', event => {
        currentTab = currentTab === index ? -1 : (tabs[currentTab] ? tabs[currentTab].classList.remove('checked') : null) ?? index;
        activeQueue.style.display = [-1, 0].includes(currentTab) ? 'block' : 'none';
        waitingQueue.style.display = [-1, 1].includes(currentTab) ? 'block' : 'none';
        stoppedQueue.style.display = [-1, 2].includes(currentTab) ? 'block' : 'none';
        tab.classList.toggle('checked');
    });
});

document.querySelectorAll('[module]').forEach(module => {
    module.addEventListener('click', event => {
        open(module.getAttribute('module') + '?popup', '_self');
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
    aria2RPCRequest([
        {id: '', jsonrpc: 2, method: 'aria2.getGlobalStat', params: [aria2RPC.jsonrpc['token']]},
        {id: '', jsonrpc: 2, method: 'aria2.tellActive', params: [aria2RPC.jsonrpc['token']]},
        {id: '', jsonrpc: 2, method: 'aria2.tellWaiting', params: [aria2RPC.jsonrpc['token'], 0, 999]},
        {id: '', jsonrpc: 2, method: 'aria2.tellStopped', params: [aria2RPC.jsonrpc['token'], 0, 999]}
    ], (global, active, waiting, stopped) => {
        document.querySelector('#suspend').style.display = 'none';
        document.querySelector('body > div > #active').innerText = global.numActive;
        document.querySelector('body > div > #waiting').innerText = global.numWaiting;
        document.querySelector('body > div > #stopped').innerText = global.numStopped;
        document.querySelector('body > div > #download').innerText = bytesToFileSize(global.downloadSpeed) + '/s';
        document.querySelector('body > div > #upload').innerText = bytesToFileSize(global.uploadSpeed) + '/s';
        active.forEach((active, index) => printTaskDetails(active, index, activeQueue));
        waiting.forEach((waiting, index) => printTaskDetails(waiting, index, waitingQueue));
        stopped.forEach((stopped, index) => printTaskDetails(stopped, index, stoppedQueue));
    }, error => {
        document.querySelector('#suspend').innerText = error;
        document.querySelector('#suspend').style.display = 'block';
        activeQueue.innerHTML = waitingQueue.innerHTML = stoppedQueue.innerHTML = '';
    }, true);
}

function printTaskDetails(result, index, queue) {
    var task = document.getElementById(result.gid) ?? createTaskList(result);
    if (task.parentNode !== queue) {
        queue.insertBefore(task, queue.childNodes[index]);
        task.setAttribute('status', result.status);
        if (result.status !== 'active') {
            updateTaskDetails(task, result);
        }
    }
    if (result.status === 'active') {
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
        aria2RPCRequest({id: '', jsonrpc: 2, method: ['active', 'waiting', 'paused'].includes(task.getAttribute('status')) ? 'aria2.forceRemove' : 'aria2.removeDownloadResult', params: [aria2RPC.jsonrpc['token'], gid]},
        result => ['complete', 'error', 'paused', 'removed'].includes(task.getAttribute('status')) ? task.remove() : task.querySelector('#name').innerText = '⏳');
    });
    task.querySelector('#invest_btn').addEventListener('click', event => open('task/index.html?' + (result.bittorrent ? 'bt' : 'http') + '#' + gid, '_self'));
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
    task.querySelector('#meter').addEventListener('click', event => {
        aria2RPCRequest({id: '', jsonrpc: 2, method: task.getAttribute('status') === 'paused' ? 'aria2.unpause' : 'aria2.pause', params: [aria2RPC.jsonrpc['token'], gid]},
        result => task.querySelector('#name').innerText = '⏳');
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
