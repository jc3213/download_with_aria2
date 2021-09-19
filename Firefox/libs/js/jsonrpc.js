var jsonrpc;
var token;
var aria2RPCClient;
var aria2RPCAssist;
var aria2KeepAlive;

function aria2RPCKeepAlive() {
    jsonrpc = aria2RPC.jsonrpc['uri'];
    token = aria2RPC.jsonrpc['token'];
    if (aria2RPCClient) {
        aria2RPCClient();
        clearInterval(aria2KeepAlive);
        aria2KeepAlive = setInterval(aria2RPCClient, aria2RPC.jsonrpc['refresh']);
    }
    if (aria2RPCAssist) {
        aria2RPCAssist();
    }
}

browser.storage.local.get(null, result => {
    if ('jsonrpc' in result) {
        aria2RPC = result;
        aria2RPCKeepAlive();
    }
    else {
        fetch('options.json').then(response => response.json()).then(json => {
            aria2RPC = json;
            aria2RPCKeepAlive();
            browser.storage.local.set(json);
        });
    }
});

browser.storage.onChanged.addListener(changes => {
    Object.keys(changes).forEach(key => {
        aria2RPC[key] = changes[key].newValue;
        if (key === 'jsonrpc') {
            aria2RPCKeepAlive();
        }
    });
});

function aria2RPCRequest(request, resolve, reject) {
    var requestJSON = Array.isArray(request) ? request : [request];
    fetch(jsonrpc, {method: 'POST', body: JSON.stringify(requestJSON)}).then(response => {
        if (response.ok) {
            return response.json();
        }
        else {
            throw(response.statusText);
        }
    }).then(responseJSON => {
        var {result, error} = responseJSON[0];
        if (result && typeof resolve === 'function') {
            resolve(...responseJSON.map(item => item.result));
        }
        if (error) {
            throw(error.message);
        }
    }).catch(error => {
        if (typeof reject === 'function') {
            reject(error);
        }
    });
}

function downloadWithAria2(url, options) {
    aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.addUri', params: [token, [url], options]},
    result => showNotification(url), showNotification);
}

function showNotification(message = '') {
    browser.notifications.create({
        type: 'basic',
        title: jsonrpc,
        iconUrl: '/icons/icon48.png',
        message: message
    }, id => {
        setTimeout(() => {
            browser.notifications.clear(id);
        }, 5000);
    });
}
