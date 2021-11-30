function aria2RPCClient() {
    printGlobalOption();
    printFeedButton();
}

document.querySelector('#submit_btn').addEventListener('click', event => {
    var options = newTaskOptions();
    document.querySelector('#entries').value.split('\n').forEach(url => /^http|^ftp|^magnet/.test(url) ? downloadWithAria2(url, options) : null);
    removeNewTaskWindow();
});

document.querySelector('#entries').addEventListener('drop', event => {
    [...event.dataTransfer.files].forEach(file => {
        var method = file.name.endsWith('torrent') ? 'aria2.addTorrent' : file.name.endsWith('metalink') || file.name.endsWith('meta4') ? 'aria2.addMetalink' : null;
        if (method) {
            fileReader(file, bin => aria2RPCRequest({id: '', jsonrpc: 2, method, params: [aria2RPC.jsonrpc['token'], bin]}, result => showNotification(file.name)));
        }
    });
    removeNewTaskWindow();
});

function newTaskOptions() {
    var options = {'header': ['Referer: ' + document.querySelector('#referer').value, 'User-Agent: ' + aria2RPC['useragent']]};
    document.querySelectorAll('[aria2], [task]').forEach(field => {
        var name = field.getAttribute('aria2') ?? field.getAttribute('task');
        options[name] = field.value;
    });
    return options;
}

function removeNewTaskWindow() {
    parent.document.querySelector('[module="newTask"]').classList.remove('checked');
    frameElement.style.display = 'none';
    setTimeout(() => frameElement.remove(), 500);
}
