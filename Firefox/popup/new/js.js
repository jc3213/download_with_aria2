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
