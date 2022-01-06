var aria2RPC;
var aria2Log = {error: 0, alive: -1};

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

function aria2RPCCall(call, resolve, reject, alive) {
    var json = 'method' in call ? {id: '', jsonrpc: 2, method: call.method, params: [aria2RPC.jsonrpc['token']].concat(call.params ?? [])}
        : {id: '', jsonrpc: 2, method: 'system.multicall', params: [ call.map(({method, params = []}) => ({methodName: method, params: [aria2RPC.jsonrpc['token'], ...params]})) ]};
    aria2RPCRequest(json, resolve, reject, alive);
}

function aria2RPCRequest(json, resolve, reject, alive) {
    fetch(aria2RPC.jsonrpc['uri'], {method: 'POST', body: JSON.stringify(json)}).then(response => {
        if (response.status !== 200) {
            throw new Error(response.statusText);
        }
        return response.json();
    }).then(json => {
        if (json.error) {
            throw json.error;
        }
        json.result && typeof resolve === 'function' && resolve(json.result);
    }).catch(error => {
        aria2Log.error = aria2Log.error === 0 && typeof reject === 'function' && reject(error.message) || 1;
    });
    aria2Log.alive = alive && setTimeout(() => aria2RPCRequest(json, resolve, reject, alive), aria2RPC.jsonrpc['refresh']);
}

function showNotification(message = '') {
    chrome.notifications.create({
        type: 'basic',
        title: aria2RPC.jsonrpc['uri'],
        iconUrl: '/icons/icon48.png',
        message
    });
}
