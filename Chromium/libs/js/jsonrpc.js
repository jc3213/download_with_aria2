var aria2RPC;
var aria2RPCClient;
var aria2KeepAlive;

function aria2RPCStartUp() {
    if (typeof aria2RPCClient === 'function') {
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
            clearTimeout(aria2KeepAlive);
            aria2RPCStartUp();
        }
    });
});

function aria2RPCRequest(request, resolve, reject, alive) {
    var requestJSON = Array.isArray(request) ? request : [request];
    fetch(aria2RPC.jsonrpc['uri'], {method: 'POST', body: JSON.stringify(requestJSON)}).then(response => {
        if (response.ok) {
            return response.json();
        }
        else {
            throw new Error(response.statusText);
        }
    }).then(responseJSON => {
        if (responseJSON[0].result && typeof resolve === 'function') {
            resolve(...responseJSON.map(({result}) => result));
            if (alive) {
                aria2KeepAlive = setTimeout(() => aria2RPCRequest(request, resolve, reject, alive), aria2RPC.jsonrpc['refresh']);
            }
        }
        if (responseJSON[0].error) {
            throw responseJSON[0].error;
        }
    }).catch(error => {
        if (typeof reject === 'function') {
            reject(error.message);
            clearTimeout(aria2KeepAlive);
        }
    });
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
        message: message
    }, id => {
        setTimeout(() => {
            chrome.notifications.clear(id);
        }, 5000);
    });
}
