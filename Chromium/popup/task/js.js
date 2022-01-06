var gid = location.hash.slice(1);
var type = location.search.slice(1);
var uris = document.querySelector('#uris');
var files = document.querySelector('#files');
var torrent = [];

document.querySelector('#session').addEventListener('click', event => {
    history.back();
});

document.querySelectorAll('[http], [bt]').forEach(field => {
    field.style.display = field.hasAttribute(type) ? field.classList.contains('module') ? 'grid' : 'block' : 'none';
});

document.querySelector('.submenu').addEventListener('change', event => {
    aria2RPCCall({method: 'aria2.changeOption', params: [gid, {[event.target.getAttribute('task')]: event.target.value}]});
});

document.querySelectorAll('.block').forEach(block => {
    var field = block.parentNode.querySelector('input');
    block.addEventListener('click', event => {
        !field.disabled && (block.style.display = field.focus() ?? 'none');
    });
    field.addEventListener('blur', event => {
        block.style.display = 'block';
    });
});

document.querySelector('button[local="uri"]').addEventListener('click', event => {
    aria2RPCCall({method: 'aria2.changeOption', params: [gid, {'all-proxy': aria2RPC.proxy['uri']}]});
});

document.querySelector('#append button').addEventListener('click', event => {
    aria2RPCCall({method: 'aria2.changeUri', params: [gid, 1, [], [document.querySelector('#append input').value]]},
    result => document.querySelector('#append input').value = '');
});

uris.addEventListener('click', event => {
    event.ctrlKey ? aria2RPCCall({method: 'aria2.changeUri', params: [gid, 1, [event.target.innerText], []]}) : navigator.clipboard.writeText(event.target.innerText);
});

files.addEventListener('click', event => {
    if (event.target.id === 'index') {
        var index = torrent.indexOf(event.target.innerText);
        var files = index !== -1 ? [...torrent.slice(0, index), ...torrent.slice(index + 1)] : [...torrent, event.target.innerText];
        aria2RPCCall({method: 'aria2.changeOption', params: [gid, {'select-file': files.join()}]},
        result => torrent = files);
    }
});

function aria2RPCClient() {
    aria2RPCCall({method: 'aria2.getOption', params: [gid]},
    options => document.querySelectorAll('[task]').forEach(task => parseValueToOption(task, 'task', options)));
    printFeedButton();
    aria2RPCCall({method: 'aria2.tellStatus', params: [gid]},
    result => {
        var disabled = ['complete', 'error'].includes(result.status);
        document.querySelector('#session').innerText = result.bittorrent && result.bittorrent.info ? result.bittorrent.info.name : result.files[0].path.slice(result.files[0].path.lastIndexOf('/') + 1) || result.files[0].uris[0].uri;
        document.querySelector('#session').className = result.status;
        document.querySelector('#local').innerText = bytesToFileSize(result.completedLength);
        document.querySelector('#ratio').innerText = ((result.completedLength / result.totalLength * 10000 | 0) / 100) + '%';
        document.querySelector('#remote').innerText = bytesToFileSize(result.totalLength);
        document.querySelector('#download').innerText = bytesToFileSize(result.downloadSpeed) + '/s';
        document.querySelector('#upload').innerText = bytesToFileSize(result.uploadSpeed) + '/s';
        document.querySelector('[task="max-download-limit"]').disabled = disabled;
        document.querySelector('[task="max-upload-limit"]').disabled = disabled || type === 'http';
        document.querySelector('[task="all-proxy"]').disabled = disabled;
        type === 'http' && printTaskUris(result.files[0].uris, uris) || type === 'bt' && printTaskFiles(result.files, files);
    }, null, true);
}

function printTableCell(table, object, resolve) {
    var cell = table.parentNode.querySelector('#template').cloneNode(true);
    cell.removeAttribute('id');
    typeof resolve === 'function' && resolve(cell, object);
    table.appendChild(cell);
    return cell;
}

function printTaskUris(uris, table) {
    var cells = table.querySelectorAll('button');
    uris.forEach((uri, index) => {
        var cell = cells[index] ?? printTableCell(table, uri);
        cell.innerText = uri.uri;
        cell.className = uri.status === 'used' ? 'active' : 'waiting';
    });
    cells.forEach((cell, index) => index > uris.length && cell.remove());
}

function printTaskFiles(files, table) {
    var cells = table.querySelectorAll('.file');
    files.forEach((file, index) => {
        var cell = cells[index] ?? printTableCell(table, file, (cell, file) => {
            cell.querySelector('#index').innerText = file.index;
            cell.querySelector('#name').innerText = file.path.slice(file.path.lastIndexOf('/') + 1);
            cell.querySelector('#name').title = file.path;
            cell.querySelector('#size').innerText = bytesToFileSize(file.length);
            file.selected === 'true' && torrent.push(file.index);
        });
        cell.querySelector('#index').className = file.selected === 'true' ? 'active' : 'error';
        cell.querySelector('#ratio').innerText = ((file.completedLength / file.length * 10000 | 0) / 100) + '%';
    });
}
