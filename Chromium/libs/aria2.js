var aria2Error = 0;
var aria2Alive = -1;

function aria2RPCCall(json, resolve, reject, alive) {
    var {jsonrpc_uri, secret_token, refresh_interval} = this.store ?? this.Storage;
    var message = JSON.stringify( json.method ? {id: '', jsonrpc: 2, method: json.method, params: [secret_token].concat(json.params ?? [])}
        : {id: '', jsonrpc: 2, method: 'system.multicall', params: [ json.map(({method, params = []}) => ({methodName: method, params: [secret_token, ...params]})) ]} );
    var worker = jsonrpc_uri.startsWith('http') ? aria2XMLRequest : aria2WebSocket;
    worker(jsonrpc_uri, message, resolve, reject);
    aria2Alive = alive ? setInterval(() => worker(jsonrpc_uri, message, resolve, reject), refresh_interval) : -1;
}

function aria2XMLRequest(jsonrpc, body, resolve, reject) {
    fetch(jsonrpc, {method: 'POST', body}).then(response => {
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

function aria2WebSocket(jsonrpc, message, resolve, reject) {
    var socket = new WebSocket(jsonrpc);
    socket.onopen = event => socket.send(message);
    socket.onmessage = event => {
        var {result, error} = JSON.parse(event.data);
        result ? typeof resolve === 'function' && resolve(result) : error && aria2Error === 0 && typeof reject === 'function' && (aria2Error = reject(error) ?? 1);
        socket.close();
    }
}
