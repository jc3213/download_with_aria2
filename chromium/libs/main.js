document.querySelectorAll('[i18n]').forEach(item => {
    item.innerText = chrome.i18n.getMessage(item.innerText);
});

document.querySelectorAll('[i18n_title]').forEach(item => {
    item.title = chrome.i18n.getMessage(item.title);
});

chrome.storage.local.get(null, json => {
    aria2Store = json;
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
    aria2RPCClient();
});

function printOptions(entries, options) {
    entries.forEach(entry => {
        entry.value = options[entry.name] ?? '';
        if (entry.hasAttribute('data-size')) {
            var size = getFileSize(entry.value);
            entry.value = size.slice(0, size.indexOf(' ')) + size.slice(size.indexOf(' ') + 1, -1);
        }
    });
}
