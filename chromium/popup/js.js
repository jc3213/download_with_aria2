var activeId;
var manager = [];
var activeQueue = document.querySelector('section#active');
var waitingQueue = document.querySelector('section#waiting');
var stoppedQueue = document.querySelector('section#stopped');
var http = document.querySelector('section#http');
var bt = document.querySelector('section#bt');

document.querySelectorAll('button[class]:not(:disabled)').forEach((tab, index) => {
    tab.addEventListener('click', event => {
        var value = (tab.parentNode.getAttribute('data-main') | 0) === index + 1 ? 0 : index + 1;
        tab.parentNode.setAttribute('data-main', value);
        document.querySelector('#queue').setAttribute('data-main', value);
    });
});

document.querySelector('#task_btn').addEventListener('click', event => {
    aria2RPCCall({method: 'aria2.getGlobalOption'}, options => {
        printOptions(document.querySelectorAll('#create input[name]'), options);
        document.body.setAttribute('data-popup', 'task');
    });
});

document.querySelector('#purdge_btn').addEventListener('click', event => {
    aria2RPCCall({method: 'aria2.tellStopped', params: [0, 99]}, stopped => stopped.forEach(({gid}) => document.querySelector('[data-gid="' + gid + '"]').remove()));
    aria2RPCCall({method: 'aria2.purgeDownloadResult'});
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
    entries && entries.forEach(url => aria2RPCCall({method: 'aria2.addUri', params: [[url], options]}, result => showNotification(url)));
    document.querySelector('#entries').value = '';
    document.body.setAttribute('data-popup', 'main');
});

document.querySelector('#upload_btn').style.display = 'browser' in this ? 'none' : 'inline-block';
document.querySelector('#upload_btn').addEventListener('change', event => {
    var options = createOptions();
    [...event.target.files].forEach(async file => {
        var method = file.name.endsWith('torrent') ? 'aria2.addTorrent' : 'aria2.addMetalink';
        var data = await promiseFileReader(file, 'readAsDataURL');
        aria2RPCCall({method, params: [data.slice(data.indexOf(',') + 1), options]}, result => showNotification(file.name));
    });
    event.target.value = '';
    document.body.setAttribute('data-popup', 'main');
});

document.querySelector('#name_btn').addEventListener('click', event => {
    activeId = http.innerHTML = bt.innerHTML = '';
    document.body.setAttribute('data-popup', 'main');
});

document.querySelector('#manager').addEventListener('change', event => {
    event.target.name && aria2RPCCall({method: 'aria2.changeOption', params: [activeId, {[event.target.name]: event.target.value}]});
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

printButton(document.querySelector('#manager [data-feed]'), (name, value) => {
    aria2RPCCall({method: 'aria2.changeOption', params: [activeId, {[name]: value}]});
});

document.querySelector('#append button').addEventListener('click', event => {
    aria2RPCCall({method: 'aria2.changeUri', params: [activeId, 1, [], [document.querySelector('#append input').value]]}, result => document.querySelector('#append input').value = '');
});

http.addEventListener('click', event => {
    event.ctrlKey ? aria2RPCCall({method: 'aria2.changeUri', params: [activeId, 1, [event.target.innerText], []]}) : navigator.clipboard.writeText(event.target.innerText);
});

bt.addEventListener('click', event => {
    if (event.target.id === 'index') {
        var index = manager.indexOf(event.target.innerText);
        var files = index !== -1 ? [...manager.slice(0, index), ...manager.slice(index + 1)] : [...manager, event.target.innerText];
        aria2RPCCall({method: 'aria2.changeOption', params: [activeId, {'select-file': files.join()}]}, result => manager = files);
    }
});

function aria2RPCClient() {
    aria2RPCCall([
        {method: 'aria2.getGlobalStat'}, {method: 'aria2.tellActive'},
        {method: 'aria2.tellWaiting', params: [0, 99]}, {method: 'aria2.tellStopped', params: [0, 99]}
    ], ([[{numActive, numWaiting, numStopped, downloadSpeed, uploadSpeed}], [active], [waiting], [stopped]]) => {
        document.querySelector('#active.stats').innerText = numActive;
        document.querySelector('#waiting.stats').innerText = numWaiting;
        document.querySelector('#stopped.stats').innerText = numStopped;
        document.querySelector('#download.stats').innerText = getFileSize(downloadSpeed) + '/s';
        document.querySelector('#upload.stats').innerText = getFileSize(uploadSpeed) + '/s';
        active.forEach((active, index) => printPopupItem(active, index, activeQueue));
        waiting.forEach((waiting, index) => printPopupItem(waiting, index, waitingQueue));
        stopped.forEach((stopped, index) => printPopupItem(stopped, index, stoppedQueue));
    }, error => {
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
}

function updatePopupItem(task, {gid, status, files, bittorrent, completedLength, totalLength, downloadSpeed, uploadSpeed, connections, numSeeders}) {
    task.querySelector('#name').innerText = bittorrent && bittorrent.info ? bittorrent.info.name : files[0].path ? files[0].path.slice(files[0].path.lastIndexOf('/') + 1) : files[0].uris[0] ? files[0].uris[0].uri : gid;
    task.querySelector('#local').innerText = getFileSize(completedLength);
    task.querySelector('#infinite').style.display = totalLength === completedLength || downloadSpeed === '0' ? 'inline-block' : printEstimatedTime(task, (totalLength - completedLength) / downloadSpeed) ?? 'none';
    task.querySelector('#connect').innerText = bittorrent ? numSeeders + ' (' + connections + ')' : connections;
    task.querySelector('#download').innerText = getFileSize(downloadSpeed) + '/s';
    task.querySelector('#upload').innerText = getFileSize(uploadSpeed) + '/s';
    task.querySelector('#ratio').innerText = task.querySelector('#ratio').style.width = ((completedLength / totalLength * 10000 | 0) / 100) + '%';
    task.querySelector('#ratio').className = status;
    activeId === gid && updateTaskDetail(task, status, bittorrent, files);
}

function printQueueItem({gid, bittorrent, totalLength}) {
    var task = document.querySelector('[data-gid="template"]').cloneNode(true);
    task.setAttribute('data-gid', gid);;
    task.querySelector('#remote').innerText = getFileSize(totalLength);
    task.querySelector('#upload').parentNode.style.display = bittorrent ? 'inline-block' : 'none';
    task.querySelector('#remove_btn').addEventListener('click', event => {
        aria2RPCCall({method: ['active', 'waiting', 'paused'].includes(task.getAttribute('status')) ? 'aria2.forceRemove' : 'aria2.removeDownloadResult', params: [gid]},
        result => ['complete', 'error', 'paused', 'removed'].includes(task.getAttribute('status')) ? task.remove() : task.querySelector('#name').innerText = '⏳');
    });
    task.querySelector('#invest_btn').addEventListener('click', event => {
        activeId = gid;
        aria2RPCCall([
            {method: 'aria2.getOption', params: [gid]}, {method: 'aria2.tellStatus', params: [gid]}
        ], ([[options], [{status, bittorrent, files}]]) => {
            printOptions(document.querySelectorAll('#manager [name]'), options);
            updateTaskDetail(task, status, bittorrent, files);
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
    var entry = button.parentNode.querySelector('input');
    button.addEventListener('click', event => {
        entry.value = aria2Store[button.getAttribute('data-feed')];
        typeof resolve === 'function' && resolve(entry.name, entry.value);
    });
}

function createOptions() {
    var options = {'header': ['Referer: ' + document.querySelector('#referer').value, 'User-Agent: ' + aria2Store['useragent']]};
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
            cell.querySelector('#size').innerText = getFileSize(length);
            selected === 'true' && manager.push(index);
        });
        cell.querySelector('#index').className = selected === 'true' ? 'active' : 'error';
        cell.querySelector('#ratio').innerText = ((completedLength / length * 10000 | 0) / 100) + '%';
    });
}
