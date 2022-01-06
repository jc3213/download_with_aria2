document.querySelector('#add_btn').addEventListener('click', event => {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
        document.querySelector('#referer').value = tabs[0].url;
    });
});

document.querySelector('#submit_btn').addEventListener('click', event => {
    var options = newTaskOptions();
    var entries = document.querySelector('#entries').value.match(/(https?:\/\/|ftp:\/\/|magnet:\?)[^\s\n]+/g);
    entries && aria2RPCCall(entries.map(url => ({method: 'aria2.addUri', params: [[url], options]})), showNotification(entries.join()));
    history.back();
});

document.querySelector('#entries').addEventListener('drop', event => {
    var options = newTaskOptions();
    [...event.dataTransfer.files].forEach(file => {
        var method = file.name.endsWith('torrent') ? 'aria2.addTorrent' : file.name.endsWith('metalink') || file.name.endsWith('meta4') ? 'aria2.addMetalink' : null;
        method && readFileAsBinary(file, data => aria2RPCCall({method, params: [data, options]}, result => showNotification(file.name)));
    });
});

function newTaskOptions() {
    var options = {'header': ['Referer: ' + document.querySelector('#referer').value, 'User-Agent: ' + aria2RPC['useragent']]};
    document.querySelectorAll('[aria2], [task]').forEach(field => options[field.getAttribute('aria2') ?? field.getAttribute('task')] = field.value);
    return options;
}

function aria2RPCClient() {
    aria2RPCCall({method: 'aria2.getGlobalOption'}, options => document.querySelectorAll('[aria2]').forEach(aria2 => parseValueToOption(aria2, 'aria2', options)));
    printFeedButton();
}
