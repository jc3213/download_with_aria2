function aria2RPCAssist() {
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
    if (file.name.endsWith('metalink') || file.name.endsWith('meta4')) {
        var reader = new FileReader();
        reader.readAsText(file);
        reader.onload = () => {
            var metalink = btoa(unescape(encodeURIComponent(reader.result)));
            aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.addMetalink', params: [token, metalink, newTaskOptions()]},
            result => {
                showNotification(file.name);
                removeNewTaskWindow();
            });
        };
    }
});

function removeNewTaskWindow() {
    parent.document.querySelector('[module="' + frameElement.id + '"]').classList.remove('checked');
    frameElement.style.display = 'none';
    setTimeout(() => frameElement.remove(), 500);
}

function newTaskOptions(options = {}) {
    document.querySelectorAll('[aria2], [task]').forEach(field => {
        var name = field.getAttribute('aria2') ?? field.getAttribute('task');
        options[name] = field.value;
    });
    return options;
}
