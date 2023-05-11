var open_in_tab = location.search === '?open_in_tab';

if (open_in_tab) {
    document.body.className = 'full';
    document.querySelector('#menu').appendChild(document.querySelector('#tool'));
}

document.querySelector('#download_btn').addEventListener('click', async event => {
    await aria2NewDownload();
    if (!open_in_tab) {
        close();
    }
});

document.querySelector('#options_btn').addEventListener('click', event => {
    chrome.runtime.openOptionsPage();
    if (!open_in_tab) {
        close();
    }
});

chrome.storage.local.get(null, json => {
    jsonrpc_uri = json['jsonrpc_uri'];
    jsonrpc_token = json['jsonrpc_token'];
    manager_interval = json['manager_interval'];
    proxy_server = json['proxy_server'];
    aria2RPC = new Aria2(jsonrpc_uri, jsonrpc_token);
    aria2StartUp();
});
