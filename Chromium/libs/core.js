var Storage;
var aria2Error = 0;
var aria2Live;

chrome.storage.local.get(null, async result => {
    Storage = 'jsonrpc_uri' in result ? result : await fetch('/options.json').then(response => response.json());
    aria2RPCClient();
});

chrome.storage.onChanged.addListener(changes => {
    Object.keys(changes).forEach(key => {
        Storage[key] = changes[key].newValue;
        ['jsonrpc_uri', 'secret_token', 'refresh_interval'].includes(key) && aria2RPCRefresh();
    });
});

function aria2RPCRefresh() {
    aria2Error = clearInterval(aria2Live) ?? 0;
    aria2RPCClient();
}

function aria2RPCCall(call, resolve, reject, alive) {
    var message = JSON.stringify( 'method' in call ? {id: '', jsonrpc: 2, method: call.method, params: [Storage['secret_token']].concat(call.params ?? [])}
        : {id: '', jsonrpc: 2, method: 'system.multicall', params: [ call.map(({method, params = []}) => ({methodName: method, params: [Storage['secret_token'], ...params]})) ]} );
    var jsonrpc = new WebSocket(Storage['jsonrpc_uri'].replace('http', 'ws'));
    jsonrpc.onopen = event => jsonrpc.send(message);
    jsonrpc.onerror = event => {
        var {error} = JSON.parse(event.data);
        aria2Error === 0 && typeof reject === 'function' && (aria2Error = reject(error) ?? 1);
    };
    jsonrpc.onmessage = event => {
        var {result} = JSON.parse(event.data);
        result && typeof resolve === 'function' && resolve(result);
    };
    alive && (aria2Live = setInterval(() => jsonrpc.send(message), Storage['refresh_interval']));
}

function showNotification(message = '') {
    chrome.notifications.create({
        type: 'basic',
        title: Storage['jsonrpc_uri'],
        iconUrl: '/icons/icon48.png',
        message
    });
}
