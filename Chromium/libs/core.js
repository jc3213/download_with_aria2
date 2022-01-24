var Storage;
var aria2Error = 0;
var aria2Live;

function aria2RPCCall(call, resolve, reject, alive) {
    var body = JSON.stringify( 'method' in call ? {id: '', jsonrpc: 2, method: call.method, params: [Storage['secret_token']].concat(call.params ?? [])}
        : {id: '', jsonrpc: 2, method: 'system.multicall', params: [ call.map(({method, params = []}) => ({methodName: method, params: [Storage['secret_token'], ...params]})) ]} );
    aria2RPCRequest() || alive && (aria2Live = setInterval(aria2RPCRequest, Storage['refresh_interval']));

    function aria2RPCRequest() {
        fetch(Storage['jsonrpc_uri'], {method: 'POST', body}).then(response => {
            if (response.status !== 200) {
                throw new Error(response.statusText);
            }
            return response.json();
        }).then(({result}) => {
            typeof resolve === 'function' && resolve(result);
        }).catch(error => {
            aria2Error === 0 && typeof reject === 'function' && (aria2Error = reject(error) ?? 1);
        });
    }
}

function showNotification(message = '') {
    chrome.notifications.create({
        type: 'basic',
        title: Storage['jsonrpc_uri'],
        iconUrl: '/icons/icon48.png',
        message
    });
}
