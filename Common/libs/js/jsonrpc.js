var jsonrpc;
var token;
var aria2RPC;
var aria2RPCClient;
var aria2KeepAlive;

function aria2RPCStartUp() {
    jsonrpc = aria2RPC.jsonrpc['uri'];
    token = aria2RPC.jsonrpc['token'];
    if (aria2RPCClient) {
        aria2RPCClient();
    }
}

chrome.storage.local.get(null, result => {
    if ('jsonrpc' in result) {
        aria2RPC = result;
        aria2RPCStartUp();
    }
    else {
        fetch('options.json').then(response => response.json()).then(json => {
            aria2RPC = json;
            aria2RPCStartUp();
            chrome.storage.local.set(json);
        });
    }
});

chrome.storage.onChanged.addListener(changes => {
    Object.keys(changes).forEach(key => {
        aria2RPC[key] = changes[key].newValue;
        if (key === 'jsonrpc') {
            aria2RPCStartUp();
        }
    });
});

function aria2RPCRequest(request, resolve, reject, alive) {
    var requestJSON = Array.isArray(request) ? request : [request];
    fetch(jsonrpc, {method: 'POST', body: JSON.stringify(requestJSON)}).then(response => {
        if (response.ok) {
            return response.json();
        }
        else {
            throw new Error(response.statusText);
        }
    }).then(responseJSON => {
        var {result, error} = responseJSON[0];
        if (result && typeof resolve === 'function') {
            resolve(...responseJSON.map(item => item.result));
            if (alive) {
                aria2KeepAlive = setTimeout(() => aria2RPCRequest(request, resolve, reject, alive), aria2RPC.jsonrpc['refresh']);
            }
        }
        if (error) {
            throw error;
        }
    }).catch(error => {
        if (typeof reject === 'function') {
            reject(error.message);
            clearTimeout(aria2KeepAlive);
        }
    });
}

function downloadWithAria2(url, options) {
    aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.addUri', params: [token, [url], options]},
    result => showNotification(url), showNotification);
}

function showNotification(message = '') {
    chrome.notifications.create({
        type: 'basic',
        title: jsonrpc,
        iconUrl: '/icons/icon48.png',
        message: message
    }, id => {
        setTimeout(() => {
            chrome.notifications.clear(id);
        }, 5000);
    });
}
