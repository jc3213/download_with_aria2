var aria2Error = 0;
var aria2Alive = -1;

function aria2RPCCall(call, resolve, reject, alive) {
    var {jsonrpc_uri, secret_token, refresh_interval} = this.store ?? this.Storage;
    var message = JSON.stringify( 'method' in call ? {id: '', jsonrpc: 2, method: call.method, params: [secret_token].concat(call.params ?? [])}
        : {id: '', jsonrpc: 2, method: 'system.multicall', params: [ call.map(({method, params = []}) => ({methodName: method, params: [secret_token, ...params]})) ]} );
    var worker = jsonrpc_uri.startsWith('http') ? aria2XMLRequest : aria2WebSocket;
    worker(jsonrpc_uri, message, resolve, reject);
    aria2Alive = alive ? setInterval(() => worker(jsonrpc_uri, message, resolve, reject), refresh_interval) : -1;
}

function aria2XMLRequest(server, body, resolve, reject) {
    fetch(server, {method: 'POST', body}).then(response => {
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

function aria2WebSocket(server, message, resolve, reject) {
    var rpc = new WebSocket(server);
    rpc.onopen = event => rpc.send(message);
    rpc.onmessage = event => {
        var {result, error} = JSON.parse(event.data);
        result ? typeof resolve === 'function' && resolve(result) : error && aria2Error === 0 && typeof reject === 'function' && (aria2Error = reject(error) ?? 1);
        rpc.close();
    }
}
