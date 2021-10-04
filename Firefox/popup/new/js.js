function aria2RPCClient() {
    printGlobalOption();
    printFeedButton();
}

document.querySelector('#submit_btn').addEventListener('click', (event) => {
    var entries = document.querySelector('#entries').value;
    var options = newTaskOptions();
    var request = entries.split('\n').map(url => ({id: '', jsonrpc: 2, method: 'aria2.addUri', params: [aria2RPC.jsonrpc['token'], [url], options]}));
    aria2RPCRequest(request, result => showNotification(entries), showNotification);
    parent.document.querySelector('[module="' + frameElement.id + '"]').classList.remove('checked');
    frameElement.style.display = 'none';
    setTimeout(() => frameElement.remove(), 500);
});

function newTaskOptions() {
    var options = {'header': ['Referer: ' + document.querySelector('#referer').value, 'User-Agent: ' + aria2RPC['useragent']]};
    document.querySelectorAll('[aria2], [task]').forEach(field => {
        var name = field.getAttribute('aria2') ?? field.getAttribute('task');
        options[name] = field.value;
    });
    return options;
}
