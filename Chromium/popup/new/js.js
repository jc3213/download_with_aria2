function aria2RPCClient() {
    printGlobalOption();
    printFeedButton();
}

document.querySelector('#submit_btn').addEventListener('click', (event) => {
    var header = ['Referer: ' + document.querySelector('#referer').value, 'User-Agent: ' + aria2RPC['useragent']];
    var options = newTaskOptions({header});
    document.querySelector('#entries').value.split('\n').forEach(url => downloadWithAria2(url, options));
    removeNewTaskWindow();
});

document.querySelector('#entries').addEventListener('drop', (event) => {
    var file = event.dataTransfer.files[0];
    if (file.name.endsWith('metalink') || file.name.endsWith('meta4') || file.name.endsWith('torrent')) {
        fileReader(file, (blob, filename) => {
            var base64 = blob.slice(blob.indexOf(',') + 1);
            var options = newTaskOptions();
            if (filename.endsWith('torrent')) {
                var method = 'aria2.addTorrent';
                var params = [token, base64];
            }
            else {
                method = 'aria2.addMetalink';
                params = [token, base64, options];
            }
            aria2RPCRequest({id: '', jsonrpc: 2, method, params},
            result => showNotification(filename), showNotification);
            removeNewTaskWindow();
        }, true);
    }
});

function newTaskOptions(options = {}) {
    document.querySelectorAll('[aria2], [task]').forEach(field => {
        var name = field.getAttribute('aria2') ?? field.getAttribute('task');
        options[name] = field.value;
    });
    return options;
}

function removeNewTaskWindow() {
    parent.document.querySelector('[module="' + frameElement.id + '"]').classList.remove('checked');
    frameElement.style.display = 'none';
    setTimeout(() => frameElement.remove(), 500);
}
