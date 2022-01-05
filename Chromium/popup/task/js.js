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
    changeTaskOption({[event.target.getAttribute('task')]: event.target.value});
});

document.querySelectorAll('.block').forEach(block => {
    var field = block.parentNode.querySelector('input');
    block.addEventListener('click', event => {
        if (!field.disabled) {
            block.style.display = 'none';
            field.focus();
        }
    });
    field.addEventListener('blur', event => {
        block.style.display = 'block';
    });
});

document.querySelector('button[local="uri"]').addEventListener('click', event => {
    changeTaskOption({'all-proxy': aria2RPC.proxy['uri']});
});

document.querySelector('#append button').addEventListener('click', event => {
    changeTaskUri({add: document.querySelector('#append input').value});
    document.querySelector('#append input').value = '';
});

uris.addEventListener('click', event => {
    event.ctrlKey ? changeTaskUri({remove: event.target.innerText}) : navigator.clipboard.writeText(event.target.innerText);
});

files.addEventListener('click', event => {
    if (event.target.id === 'index') {
        var index = torrent.indexOf(event.target.innerText);
        var files = index !== -1 ? [...torrent.slice(0, index), ...torrent.slice(index + 1)] : [...torrent, event.target.innerText];
        changeTaskOption({'select-file': files.join()}, result => torrent = files);
    }
});

function aria2RPCClient() {
    aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.getOption', params: [aria2RPC.jsonrpc['token'], gid]},
    options => document.querySelectorAll('[task]').forEach(task => parseValueToOption(task, 'task', options)));
    printFeedButton();
    aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.tellStatus', params: [aria2RPC.jsonrpc['token'], gid]},
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
        type === 'http' ? printTaskUris(result.files[0].uris, uris) : type === 'bt' ? printTaskFiles(result.files, files) : null;
    }, null, true);
}

function printTableCell(table, object, resolve) {
    var cell = table.parentNode.querySelector('#template').cloneNode(true);
    cell.removeAttribute('id');
    typeof resolve === 'function' ? resolve(cell, object) : null;
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
    cells.forEach((cell, index) => index > uris.length ? cell.remove() : null);
}

function printTaskFiles(files, table) {
    var cells = table.querySelectorAll('.file');
    files.forEach((file, index) => {
        var cell = cells[index] ?? printTableCell(table, file, (cell, file) => {
            cell.querySelector('#index').innerText = file.index;
            cell.querySelector('#name').innerText = file.path.slice(file.path.lastIndexOf('/') + 1);
            cell.querySelector('#name').title = file.path;
            cell.querySelector('#size').innerText = bytesToFileSize(file.length);
            file.selected === 'true' ? torrent.push(file.index) : null;
        });
        cell.querySelector('#index').className = file.selected === 'true' ? 'active' : 'error';
        cell.querySelector('#ratio').innerText = ((file.completedLength / file.length * 10000 | 0) / 100) + '%';
    });
}

function changeTaskOption(options, resolve) {
    aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.changeOption', params: [aria2RPC.jsonrpc['token'], gid, options]}, resolve);
}

function changeTaskUri({add, remove}) {
    aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.changeUri', params: [aria2RPC.jsonrpc['token'], gid, 1, remove ? [remove] : [], add ? [add] : []]});
}
