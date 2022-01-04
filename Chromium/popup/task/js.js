var gid = location.hash.slice(1);
var type = location.search.slice(1);
var files = document.querySelector('#files');
var uris = document.querySelector('#uris');

document.querySelector('#session').addEventListener('click', event => {
    history.back();
});

document.querySelectorAll('[http], [bt]').forEach(field => {
    field.style.display = field.hasAttribute(type) ? field.classList.contains('module') ? 'grid' : 'block' : 'none';
});

document.querySelector('.submenu').addEventListener('change', event => {
    changeTaskOption(gid, event.target.getAttribute('task'), event.target.value);
});

document.querySelectorAll('.plate').forEach(node => {
    var label = node.parentNode.querySelector('label');
    var field = label.querySelector('input');
    node.addEventListener('click', event => {
        if (!field.disabled) {
            node.style.display = 'none';
            label.style.display = 'block';
            field.focus();
        }
    });
    field.addEventListener('change', event => {
        label.style.display = 'none';
        node.style.display = 'block';
    });
});

document.querySelector('button[local="uri"]').addEventListener('click', event => {
    changeTaskOption(gid, 'all-proxy', aria2RPC.proxy['uri']);
});

document.querySelector('#append button').addEventListener('click', event => {
    changeTaskUri({add: document.querySelector('#append input').value});
    document.querySelector('#append input').value = '';
});

uris.addEventListener('click', event => {
    event.ctrlKey ? changeTaskUri({remove: event.target.innerText}) : navigator.clipboard.writeText(event.target.innerText);
});

files.addEventListener('click', event => {
    if (event.target.tagName === 'BUTTON') {
        var checked = '';
        files.querySelectorAll('#index').forEach(file => {
            if (file === event.target && file.className !== 'active' || file !== event.target && file.className === 'active') {
                checked += ',' + file.innerText;
            }
        });
        changeTaskOption(gid, 'select-file', checked.slice(1));
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
        type === 'bt' ? printTaskFiles(result.files, files) : type === 'http' ? printTaskUris(result.files[0].uris, uris) : null;
    }, null, true);
}

function printTaskUris(uris, table) {
    var cells = table.querySelectorAll('button');
    uris.forEach(uri => {
        var cell = cells[index] ?? printTableCell(table, uri);
        cell.innerText = uri.uri;
        cell.className = uri.status === 'used' ? 'active' : 'waiting';
    });
    cells.forEach((cell, index) => index > uris.length ? cell.remove() : null);
}

function printTableCell(table, object, resolve) {
    var cell = table.parentNode.querySelector('#template').cloneNode(true);
    cell.removeAttribute('id');
    typeof resolve === 'function' ? resolve(cell, object) : null;
    table.appendChild(cell);
    return cell;
}

function printTaskFiles(files, table) {
    var cells = table.querySelectorAll('.file');
    files.forEach(file => {
        var cell = cells[index] ?? printTableCell(table, file, (cell, file) => {
            cell.querySelector('#index').innerText = file.index;
            cell.querySelector('#name').innerText = file.path.slice(file.path.lastIndexOf('/') + 1);
            cell.querySelector('#name').title = file.path;
            cell.querySelector('#size').innerText = bytesToFileSize(file.length);
        });
        cell.querySelector('#index').className = file.selected === 'true' ? 'active' : 'error';
        cell.querySelector('#ratio').innerText = ((file.completedLength / file.length * 10000 | 0) / 100) + '%';
    });
}

function changeTaskOption(gid, name, value) {
    aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.changeOption', params: [aria2RPC.jsonrpc['token'], gid, {[name]: value}]});
}

function changeTaskUri({add, remove}) {
    aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.changeUri', params: [aria2RPC.jsonrpc['token'], gid, 1, remove ? [remove] : [], add ? [add] : []]});
}
