var aria2Alive = -1;

function aria2RPCCall(json, resolve, reject, alive) {
    var {jsonrpc_uri, secret_token, refresh_interval} = this.store ?? this.Storage;
    var message = JSON.stringify( json.method ? {id: '', jsonrpc: 2, method: json.method, params: [secret_token].concat(json.params ?? [])}
        : {id: '', jsonrpc: 2, method: 'system.multicall', params: [ json.map(({method, params = []}) => ({methodName: method, params: [secret_token, ...params]})) ]} );
    var worker = jsonrpc_uri.startsWith('http') ? aria2XMLRequest : aria2WebSocket;
    worker(jsonrpc_uri, message, resolve, reject) || alive && (aria2Alive = setInterval(() => worker(jsonrpc_uri, message, resolve, reject), refresh_interval));
}

function aria2XMLRequest(server, body, resolve, reject) {
    fetch(server, {method: 'POST', body}).then(response => response.json())
        .then(({result, error}) => result ? typeof resolve === 'function' && resolve(result) : typeof reject === 'function' && reject())
        .catch(reject);
}

function aria2WebSocket(server, message, resolve, reject) {
    var socket = new WebSocket(server);
    socket.onopen = event => socket.send(message);
    socket.onclose = reject;
    socket.onmessage = event => {
        var {result, error} = JSON.parse(event.data);
        result ? typeof resolve === 'function' && resolve(result) : typeof reject === 'function' && reject();
        socket.onclose = socket.close();
    };
}
