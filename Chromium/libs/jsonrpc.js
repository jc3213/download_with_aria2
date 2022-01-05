var aria2RPC;
var aria2Log = {error: 0, alive: -1};
var aria2RPCClient;

chrome.storage.local.get(null, async result => {
    aria2RPC = 'jsonrpc' in result ? result : await fetch('/options.json').then(response => response.json());
    aria2RPCClient();
});

chrome.storage.onChanged.addListener(changes => {
    Object.keys(changes).forEach(key => {
        aria2RPC[key] = changes[key].newValue;
        key === 'jsonrpc' && aria2RPCRefresh();
    });
});

function aria2RPCRefresh() {
    clearTimeout(aria2Log.alive);
    aria2Log.error = 0;
    aria2RPCClient();
}

function aria2RPCRequest(request, resolve, reject, alive) {
    var requestJSON = Array.isArray(request) ? request : [request];
    fetch(aria2RPC.jsonrpc['uri'], {method: 'POST', body: JSON.stringify(requestJSON)}).then(response => {
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        return response.json();
    }).then(responseJSON => {
        if (responseJSON[0].error) {
            throw responseJSON[0].error;
        }
        responseJSON[0].result && typeof resolve === 'function' && resolve(...responseJSON.map(({result}) => result));
    }).catch(error => {
        aria2Log.error = aria2Log.error === 0 && typeof reject === 'function' && reject(error.message) || 1;
    });
    aria2Log.alive = alive && setTimeout(() => aria2RPCRequest(request, resolve, reject, alive), aria2RPC.jsonrpc['refresh']);
}

function downloadWithAria2(url, options) {
    aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.addUri', params: [aria2RPC.jsonrpc['token'], [url], options]},
    result => showNotification(url), showNotification);
}

function showNotification(message = '') {
    chrome.notifications.create({
        type: 'basic',
        title: aria2RPC.jsonrpc['uri'],
        iconUrl: '/icons/icon48.png',
        message
    });
}
