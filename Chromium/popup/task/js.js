var gid = location.hash.slice(1);
var type = location.search.slice(1);
var uri = [];

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

document.querySelector('#uris').addEventListener('click', event => {
    event.ctrlKey ? changeTaskUri({remove: event.target.innerText}) : navigator.clipboard.writeText(event.target.innerText);
});

document.querySelector('#append button').addEventListener('click', event => {
    changeTaskUri({add: document.querySelector('#append input').value});
    document.querySelector('#append input').value = '';
});

document.querySelector('#files').addEventListener('click', event => {
    if (event.target.className) {
        var checked = '';
        document.querySelectorAll('td:nth-child(1)').forEach(file => {
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
        if (type === 'bt') {
            result.files.forEach(file => printTaskFiles(file, document.querySelector('#files')));
        }
        if (type === 'http') {
            result.files[0].uris.forEach(uri => printTaskUris(uri, document.querySelector('#uris')));
        }
    }, null, true);
}

function printTaskUris(uri, table) {
    var cells = table.querySelectorAll('div');
    var uris = [...cells].map(cell => cell.innerText);
    var index = uris.indexOf(uri.uri);
    var cell = index === -1 ? appendUriToTable(uri, table) : cells[index];
    cell.className = 'uris ' + (uri.status === 'used' ? 'active' : 'waiting');
}

function appendUriToTable(uri, table) {
    var cell = table.querySelector('#template').cloneNode(true);
    cell.removeAttribute('id');
    cell.innerText = uri.uri;
    table.appendChild(cell);
    return cell;
}

function printTaskFiles(file, table) {
    var cell = appendFileToTable(file, table);
    cell.querySelector('#index').className = file.selected === 'true' ? 'active' : 'error';
    cell.querySelector('#ratio').innerText = ((file.completedLength / file.length * 10000 | 0) / 100) + '%';
}

function appendFileToTable(file, table) {
    var id = file.index + file.length;
    var cell = document.getElementById(id) ?? table.querySelector('#template').cloneNode(true);
    cell.id = id;
    cell.querySelector('#index').innerText = file.index;
    cell.querySelector('#name').innerText = file.path.slice(file.path.lastIndexOf('/') + 1);
    cell.querySelector('#name').title = file.path;
    cell.querySelector('#size').innerText = bytesToFileSize(file.length);
    table.appendChild(cell);
    return cell;
}

function changeTaskOption(gid, name, value) {
    aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.changeOption', params: [aria2RPC.jsonrpc['token'], gid, {[name]: value}]});
}

function changeTaskUri({add, remove}) {
    aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.changeUri', params: [aria2RPC.jsonrpc['token'], gid, 1, remove ? [remove] : [], add ? [add] : []]});
}
