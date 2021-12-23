function aria2RPCClient() {
    printGlobalOption();
    printFeedButton();
}

document.querySelector('#submit_btn').addEventListener('click', event => {
    var options = newTaskOptions();
    var entries = document.querySelector('#entries').value.match(/(https?:\/\/|ftp:\/\/|magnet:\?)[^\s\n]+/g);
    if (Array.isArray(entries)) {
        entries.forEach(url => downloadWithAria2(url, options));
        showNotification(entries.join());
    }
    history.back();
});

document.querySelector('#entries').addEventListener('drop', event => {
    [...event.dataTransfer.files].forEach(file => {
        var method = file.name.endsWith('torrent') ? 'aria2.addTorrent' : file.name.endsWith('metalink') || file.name.endsWith('meta4') ? 'aria2.addMetalink' : null;
        if (method) {
            fileReader(file, data => aria2RPCRequest({id: '', jsonrpc: 2, method, params: [aria2RPC.jsonrpc['token'], data, newTaskOptions()]}, result => showNotification(file.name)));
        }
    });
    history.back();
});

function newTaskOptions() {
    var options = {'header': ['Referer: ' + document.querySelector('#referer').value, 'User-Agent: ' + aria2RPC['useragent']]};
    document.querySelectorAll('[aria2], [task]').forEach(field => {
        var name = field.getAttribute('aria2') ?? field.getAttribute('task');
        options[name] = field.value;
    });
    return options;
}
