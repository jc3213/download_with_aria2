document.querySelector('#add_btn').addEventListener('click', async event => {
    var tabs = await browser.tabs.query({active: true, currentWindow: true});
    document.querySelector('#referer').value = tabs[0].url;
});

document.querySelector('#submit_btn').addEventListener('click', event => {
    var options = {'header': ['Referer: ' + document.querySelector('#referer').value, 'User-Agent: ' + aria2RPC['useragent']]};
    document.querySelectorAll('input:not([id])').forEach(field => options[field.name] = field.value);
    var entries = document.querySelector('#entries').value.match(/(https?:\/\/|ftp:\/\/|magnet:\?)[^\s\n]+/g);
    entries && aria2RPCCall(entries.map(url => ({method: 'aria2.addUri', params: [[url], options]})), showNotification(entries.join()));
    history.back();
});

function aria2RPCClient() {
    aria2RPCCall({method: 'aria2.getGlobalOption'}, printOptions);
    printButton();
}
