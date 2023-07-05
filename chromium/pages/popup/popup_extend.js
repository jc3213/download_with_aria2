var open_in_tab = location.search === '?open_in_tab';

if (open_in_tab) {
    document.body.classList.add('full');
}
else {
    chooseQueue.style.left = `${queuebtn.offsetLeft + 8}px`;
}

async function managerDownload() {
    await aria2NewDownload();
    if (!open_in_tab) {
        close();
    }
}

function managerOptions() {
    chrome.runtime.openOptionsPage();
    if (!open_in_tab) {
        close();
    }
}

chrome.storage.onChanged.addListener((changes) => {
    var {jsonrpc_uri, jsonrpc_token, manager_newtab, manager_interval, proxy_server} = changes;
    if (jsonrpc_uri || jsonrpc_token) {
        aria2Server = jsonrpc_uri?.newValue ?? aria2Server;
        aria2Token = jsonrpc_token?.newValue ?? aria2Token;
        clearInterval(aria2Alive);
        aria2Socket?.close();
        aria2StartUp();
    }
    if (manager_interval) {
        aria2Interval = manager_interval.newValue;
        clearInterval(aria2Alive);
        aria2Alive = setInterval(updateManager, aria2Interval);
    }
    if (manager_newtab?.newValue === false) {
        close();
    }
    if (proxy_server) {
        aria2Proxy = proxy_server.newValue;
    }
});

chrome.storage.local.get(null, json => {
    aria2Server = json['jsonrpc_uri'];
    aria2Token = json['jsonrpc_token'];
    aria2Interval = json['manager_interval'];
    aria2Proxy = json['proxy_server'];
    aria2StartUp();
});
