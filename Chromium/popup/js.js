document.querySelectorAll('[tab]').forEach(tab => {
    var active = tab.getAttribute('tab');
    tab.addEventListener('click', (event) => {
        document.querySelectorAll('[panel]').forEach(panel => {
            var id = panel.getAttribute('panel');
            if (tab.classList.contains('checked')) {
                panel.style.display = 'block';
            }
            else if (id === active) {
                panel.style.display = 'block';
            }
            else {
                panel.style.display = 'none';
                document.querySelector('[tab="' + id + '"]').classList.remove('checked');
            }
        });
        tab.classList.toggle('checked');
    });
});

document.querySelectorAll('[module]').forEach(module => {
    var id = module.getAttribute('module');
    var url = module.getAttribute('link') + '?popup';
    module.addEventListener('click', (event) => {
        if (event.target.classList.contains('checked')) {
            document.getElementById(id).remove();
        }
        else {
            openModuleWindow(id, url);
        }
        module.classList.toggle('checked');
    });
});

document.querySelector('#purdge_btn').addEventListener('click', (event) => {
    aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.purgeDownloadResult', params: [aria2RPC.jsonrpc['token']]},
    result => document.querySelector('[panel="stopped"]').innerHTML = '');
});

function aria2RPCClient() {
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
        document.querySelector('#menus').style.display = 'block';
        document.querySelector('#caution').style.display = 'none';
        active.forEach((active, index) => printTaskDetails(active, index, document.querySelector('[panel="active"]')));
        waiting.forEach((waiting, index) => printTaskDetails(waiting, index, document.querySelector('[panel="waiting"]')));
        stopped.forEach((stopped, index) => printTaskDetails(stopped, index, document.querySelector('[panel="stopped"]')));
    }, error => {
        document.querySelector('#menus').style.display = 'none';
        document.querySelector('#caution').innerText = error;
        document.querySelector('#caution').style.display = 'block';
        document.querySelector('[panel="active"]').innerHTML = '';
        document.querySelector('[panel="waiting"]').innerHTML = '';
        document.querySelector('[panel="stopped"]').innerHTML = '';
    }, true);
}

function printTaskDetails(result, index, queue) {
    var task = document.getElementById(result.gid) ?? appendTaskDetails(result);
    if (task.status !== result.status) {
        queue.insertBefore(task, queue.childNodes[index]);
        task.setAttribute('status', result.status);
    }
    task.querySelector('#name').innerText = result.bittorrent && result.bittorrent.info ? result.bittorrent.info.name : result.files[0].path ? result.files[0].path.slice(result.files[0].path.lastIndexOf('/') + 1) : result.files[0].uris[0] ? result.files[0].uris[0].uri : result.gid;
    task.querySelector('#error').innerText = result.errorMessage ?? '';
    task.querySelector('#local').innerText = bytesToFileSize(result.completedLength);
    calcEstimatedTime(task, (result.totalLength - result.completedLength) / result.downloadSpeed);
    task.querySelector('#remote').innerText = bytesToFileSize(result.totalLength);
    task.querySelector('#connect').innerText = result.bittorrent ? result.numSeeders + ' (' + result.connections + ')' : result.connections;
    task.querySelector('#download').innerText = bytesToFileSize(result.downloadSpeed) + '/s';
    task.querySelector('#upload').innerText = bytesToFileSize(result.uploadSpeed) + '/s';
    task.querySelector('#ratio').innerText = task.querySelector('#ratio').style.width = ((result.completedLength / result.totalLength * 10000 | 0) / 100) + '%';
    task.querySelector('#ratio').className = result.status;
    task.querySelector('#retry_btn').style.display = !result.bittorrent && ['error', 'removed'].includes(result.status) ? 'inline-block' : 'none';
}

function appendTaskDetails(result) {
    var task = document.querySelector('#template').cloneNode(true);
    task.id = result.gid;
    task.querySelector('#upload').parentNode.style.display = result.bittorrent ? 'inline-block' : 'none';
    task.querySelector('#remove_btn').addEventListener('click', (event) => removeTaskFromQueue(result.gid, task.getAttribute('status')));
    task.querySelector('#invest_btn').addEventListener('click', (event) => openTaskMgrWindow(result.gid, result.bittorrent ? 'bt' : 'http'));
    task.querySelector('#retry_btn').addEventListener('click', (event) => removeTaskAndRetry(result.gid));
    task.querySelector('#fancybar').addEventListener('click', (event) => pauseOrUnpauseTask(result.gid, task.getAttribute('status')));
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

function removeTaskFromQueue(gid, status) {
    aria2RPCRequest({id: '', jsonrpc: 2, method: ['active', 'waiting', 'paused'].includes(status) ? 'aria2.forceRemove' : 'aria2.removeDownloadResult', params: [aria2RPC.jsonrpc['token'], gid]},
    resule => ['complete', 'error', 'paused', 'removed'].includes(status) ? document.getElementById(gid).remove() : document.getElementById(gid).setAttribute('status', 'removed'));
}

function openTaskMgrWindow(gid, type) {
    openModuleWindow('taskMgr', 'task/index.html?' + type+ '#' + gid);
}

function removeTaskAndRetry(gid) {
    aria2RPCRequest([
        {id: '', jsonrpc: 2, method: 'aria2.getFiles', params: [aria2RPC.jsonrpc['token'], gid]},
        {id: '', jsonrpc: 2, method: 'aria2.getOption', params: [aria2RPC.jsonrpc['token'], gid]},
        {id: '', jsonrpc: 2, method: 'aria2.removeDownloadResult', params: [aria2RPC.jsonrpc['token'], gid]}
    ], (files, options) => {
        aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.addUri', params: [aria2RPC.jsonrpc['token'], files[0].uris.map(({uri}) => uri), options]},
        result => document.getElementById(gid).remove());
    });
}

function pauseOrUnpauseTask(gid, status) {
    if (['active', 'waiting'].includes(status)) {
        aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.pause', params: [aria2RPC.jsonrpc['token'], gid]},
        result => document.getElementById(gid).setAttribute('status', 'paused'));
    }
    else if (status === 'paused') {
        aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.unpause', params: [aria2RPC.jsonrpc['token'], gid]},
        result => document.getElementById(gid).setAttribute('status', 'active'));
    }
}
