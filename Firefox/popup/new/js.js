function aria2RPCClient() {
    aria2RPCCall({method: 'aria2.getGlobalOption'}, options => document.querySelectorAll('[aria2]').forEach(aria2 => parseValueToOption(aria2, 'aria2', options)));
    printFeedButton();
}

document.querySelector('#add_btn').addEventListener('click', async event => {
    var tabs = await browser.tabs.query({active: true, currentWindow: true});
    document.querySelector('#referer').value = tabs[0].url;
});

document.querySelector('#submit_btn').addEventListener('click', event => {
    var options = {'header': ['Referer: ' + document.querySelector('#referer').value, 'User-Agent: ' + aria2RPC['useragent']]};
    document.querySelectorAll('[aria2], [task]').forEach(field => options[field.getAttribute('aria2') ?? field.getAttribute('task')] = field.value);
    var entries = document.querySelector('#entries').value.match(/(https?:\/\/|ftp:\/\/|magnet:\?)[^\s\n]+/g);
    Array.isArray(entries) && aria2RPCCall(entries.map(url => ({method: 'aria2.addUri', params: [[url], options]})), showNotification(entries.join()));
    history.back();
});
