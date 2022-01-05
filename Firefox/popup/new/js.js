function aria2RPCClient() {
    printGlobalOption();
    printFeedButton();
}

document.querySelector('#add_btn').addEventListener('click', async event => {
    var tabs = await browser.tabs.query({active: true, currentWindow: true});
    document.querySelector('#referer').value = tabs[0].url;
});

document.querySelector('#submit_btn').addEventListener('click', event => {
    var options = {'header': ['Referer: ' + document.querySelector('#referer').value, 'User-Agent: ' + aria2RPC['useragent']]};
    document.querySelectorAll('[aria2], [task]').forEach(field => {
        var name = field.getAttribute('aria2') ?? field.getAttribute('task');
        options[name] = field.value;
    });
    var entries = document.querySelector('#entries').value.match(/(https?:\/\/|ftp:\/\/|magnet:\?)[^\s\n]+/g);
    Array.isArray(entries) && entries.forEach(url => downloadWithAria2(url, options));
    history.back();
});
