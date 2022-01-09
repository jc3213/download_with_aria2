var gid;
var manager = [];
var activeTab = -1;
var activeQueue = document.querySelector('#queue #active');
var waitingQueue = document.querySelector('#queue #waiting');
var stoppedQueue = document.querySelector('#queue #stopped');
var http = document.querySelector('[data-http] #form');
var bt = document.querySelector('[data-bt] #form');

document.querySelectorAll('[data-tab]').forEach((tab, index, tabs) => {
    tab.addEventListener('click', event => {
        activeTab !== - 1 && tabs[activeTab].classList.remove('checked');
        activeTab = activeTab === index ? tab.classList.remove('checked') ?? -1 : tab.classList.add('checked') ?? index;
        activeQueue.style.display = [-1, 0].includes(activeTab) ? 'block' : 'none';
        waitingQueue.style.display = [-1, 1].includes(activeTab) ? 'block' : 'none';
        stoppedQueue.style.display = [-1, 2].includes(activeTab) ? 'block' : 'none';
    });
});

document.querySelector('#task_btn').addEventListener('click', event => {
    aria2RPCCall({method: 'aria2.getGlobalOption'}, options => {
        printOptions(document.querySelectorAll('#create input[name]'), options);
        document.body.setAttribute('data-popup', 'task');
    });
});

document.querySelector('#purdge_btn').addEventListener('click', event => {
    aria2RPCCall({method: 'aria2.purgeDownloadResult'}, result => {
        activeQueue.innerHTML = waitingQueue.innerHTML = stoppedQueue.innerHTML = '';
        aria2RPCRefresh();
    });
});

document.querySelector('#options_btn').addEventListener('click', event => {
    open('/options/index.html?popup', '_self');
});

document.querySelector('#referer_btn').addEventListener('click', event => {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
        document.querySelector('#referer').value = tabs[0].url;
    });
});

printButton(document.querySelector('#create [data-feed]'));

document.querySelector('#submit_btn').addEventListener('click', event => {
    var options = createOptions();
    var entries = document.querySelector('#entries').value.match(/(https?:\/\/|ftp:\/\/|magnet:\?)[^\s\n]+/g);
    entries && aria2RPCCall(entries.map(url => ({method: 'aria2.addUri', params: [[url], options]})), result => document.querySelector('#entries').value = showNotification(entries.join()) ?? '');
    document.body.setAttribute('data-popup', 'main');
});

document.querySelector('#upload_btn').style.display = 'browser' in this ? 'none' : 'inline-block';
document.querySelector('#upload_btn').addEventListener('change', event => {
    var options = createOptions();
    var file = event.target.files[0];
    readFileAsBinary(file, data => aria2RPCCall({method: file.name.endsWith('torrent') ? 'aria2.addTorrent' : 'aria2.addMetalink', params: [data, options]}, result => showNotification(file.name)));
    document.body.setAttribute('data-popup', 'main');
});

document.querySelector('#name_btn').addEventListener('click', event => {
    gid = null;
    document.body.setAttribute('data-popup', 'main');
    aria2RPCRefresh();
});

document.querySelectorAll('#manager .block').forEach(block => {
    var field = block.parentNode.querySelector('input');
    block.addEventListener('click', event => {
        !field.disabled && (block.style.display = field.focus() ?? 'none');
    });
    field.addEventListener('blur', event => {
        block.style.display = 'block';
    });
});

printButton(document.querySelector('#manager [data-feed]'), (name, value) => {
    aria2RPCCall({method: 'aria2.changeOption', params: [gid, {[name]: value}]});
});

document.querySelector('#append button').addEventListener('click', event => {
    aria2RPCCall({method: 'aria2.changeUri', params: [gid, 1, [], [document.querySelector('#append input').value]]}, result => document.querySelector('#append input').value = '');
});

http.addEventListener('click', event => {
    event.ctrlKey ? aria2RPCCall({method: 'aria2.changeUri', params: [gid, 1, [event.target.innerText], []]}) : navigator.clipboard.writeText(event.target.innerText);
});

bt.addEventListener('click', event => {
    if (event.target.id === 'index') {
        var index = manager.indexOf(event.target.innerText);
        var files = index !== -1 ? [...manager.slice(0, index), ...manager.slice(index + 1)] : [...manager, event.target.innerText];
        aria2RPCCall({method: 'aria2.changeOption', params: [gid, {'select-file': files.join()}]}, result => manager = files);
    }
});

function aria2RPCClient() {
    aria2RPCCall([
        {method: 'aria2.getGlobalStat'}, {method: 'aria2.tellActive'},
        {method: 'aria2.tellWaiting', params: [0, 999]}, {method: 'aria2.tellStopped', params: [0, 999]}
    ], ([[global], [active], [waiting], [stopped]]) => {
        document.querySelector('#message').style.display = 'none';
        document.querySelector('#active.stats').innerText = global.numActive;
        document.querySelector('#waiting.stats').innerText = global.numWaiting;
        document.querySelector('#stopped.stats').innerText = global.numStopped;
        document.querySelector('#download.stats').innerText = bytesToFileSize(global.downloadSpeed) + '/s';
        document.querySelector('#upload.stats').innerText = bytesToFileSize(global.uploadSpeed) + '/s';
        active.forEach((active, index) => printPopupItem(active, index, activeQueue));
        waiting.forEach((waiting, index) => printPopupItem(waiting, index, waitingQueue));
        stopped.forEach((stopped, index) => printPopupItem(stopped, index, stoppedQueue));
    }, error => {
        document.querySelector('#message').innerText = error;
        document.querySelector('#message').style.display = 'block';
        activeQueue.innerHTML = waitingQueue.innerHTML = stoppedQueue.innerHTML = '';
    }, true);
}

function printPopupItem(result, index, queue) {
    var task = document.querySelector('[data-gid="' + result.gid + '"]') ?? printQueueItem(result);
    if (task.parentNode !== queue) {
        queue.insertBefore(task, queue.childNodes[index]);
        task.setAttribute('status', result.status);
        task.querySelector('#error').innerText = result.errorMessage ?? '';
        task.querySelector('#retry_btn').style.display = !result.bittorrent && ['error', 'removed'].includes(result.status) ? 'inline-block' : 'none';
        result.status !== 'active' && updatePopupItem(task, result);
    }
    result.status === 'active' && updatePopupItem(task, result);
    gid === result.gid && updateTaskDetail(task, result);
}

function updatePopupItem(task, {gid, status, files, bittorrent, completedLength, totalLength, downloadSpeed, uploadSpeed, connections, numSeeders}) {
    task.querySelector('#name').innerText = bittorrent && bittorrent.info ? bittorrent.info.name : files[0].path ? files[0].path.slice(files[0].path.lastIndexOf('/') + 1) : files[0].uris[0] ? files[0].uris[0].uri : gid;
    task.querySelector('#local').innerText = bytesToFileSize(completedLength);
    task.querySelector('#infinite').style.display = totalLength === completedLength || downloadSpeed === '0' ? 'inline-block' : printEstimatedTime(task, (totalLength - completedLength) / downloadSpeed) ?? 'none';
    task.querySelector('#connect').innerText = bittorrent ? numSeeders + ' (' + connections + ')' : connections;
    task.querySelector('#download').innerText = bytesToFileSize(downloadSpeed) + '/s';
    task.querySelector('#upload').innerText = bytesToFileSize(uploadSpeed) + '/s';
    task.querySelector('#ratio').innerText = task.querySelector('#ratio').style.width = ((completedLength / totalLength * 10000 | 0) / 100) + '%';
    task.querySelector('#ratio').className = status;
}

function printQueueItem({gid, bittorrent, totalLength}) {
    var task = document.querySelector('[data-gid="template"]').cloneNode(true);
    task.setAttribute('data-gid', gid);;
    task.querySelector('#remote').innerText = bytesToFileSize(totalLength);
    task.querySelector('#upload').parentNode.style.display = bittorrent ? 'inline-block' : 'none';
    task.querySelector('#remove_btn').addEventListener('click', event => {
        aria2RPCCall({method: ['active', 'waiting', 'paused'].includes(task.getAttribute('status')) ? 'aria2.forceRemove' : 'aria2.removeDownloadResult', params: [gid]},
        result => ['complete', 'error', 'paused', 'removed'].includes(task.getAttribute('status')) ? task.remove() : task.querySelector('#name').innerText = '⏳');
    });
    task.querySelector('#invest_btn').addEventListener('click', event => {
        aria2RPCCall([
            {method: 'aria2.getOption', params: [gid]}, {method: 'aria2.tellStatus', params: [gid]}
        ], ([[options], [result]]) => {
            this.gid = gid;
            printOptions(document.querySelectorAll('#manager input[name]'), options);
            updateTaskDetail(task, result);
            document.body.setAttribute('data-popup', 'aria2');
            document.querySelector('#manager').setAttribute('data-aria2', bittorrent ? 'bt' : 'http');
            document.querySelector('#manager #remote').innerText = task.querySelector('#remote').innerText;
        });
    });
    task.querySelector('#retry_btn').addEventListener('click', event => {
        aria2RPCCall([
            {method: 'aria2.getFiles', params: [gid]}, {method: 'aria2.getOption', params: [gid]},
            {method: 'aria2.removeDownloadResult', params: [gid]}
        ], ([[files], [options]]) => {
            aria2RPCCall({method: 'aria2.addUri', params: [files[0].uris.map(({uri}) => uri), options]},
            result => task.remove());
        });
    });
    task.querySelector('#meter').addEventListener('click', event => {
        aria2RPCCall({method: task.getAttribute('status') === 'paused' ? 'aria2.unpause' : 'aria2.pause', params: [gid]}, result => task.querySelector('#name').innerText = '⏳');
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

function printButton(button, resolve) {
    var rule = button.getAttribute('data-feed').match(/[^:]+/g);
    var name = rule[0], root = rule[1];
    var entry = button.parentNode.querySelector('input');
    button.addEventListener('click', event => {
        entry.value = root in aria2RPC ? aria2RPC[root][name] : aria2RPC[name];
        typeof resolve === 'function' && resolve(entry.name, entry.value);
    });
}

function createOptions() {
    var options = {'header': ['Referer: ' + document.querySelector('#referer').value, 'User-Agent: ' + aria2RPC['useragent']]};
    document.querySelectorAll('#create input[name]').forEach(field => options[field.name] = field.value);
    return options;
}

function updateTaskDetail(task, {status, bittorrent, files}) {
    var disabled = ['complete', 'error'].includes(status);
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
    var cell = table.parentNode.querySelector('[data-' + type + '="template"]').cloneNode(true);
    cell.removeAttribute('data-' + type);
    typeof resolve === 'function' && resolve(cell);
    table.appendChild(cell);
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
            cell.querySelector('#size').innerText = bytesToFileSize(length);
            selected === 'true' && manager.push(index);
        });
        cell.querySelector('#index').className = selected === 'true' ? 'active' : 'error';
        cell.querySelector('#ratio').innerText = ((completedLength / length * 10000 | 0) / 100) + '%';
    });
}
