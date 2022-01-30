var aria2Alive = -1;

function aria2RPCCall(json, resolve, reject, alive) {
    var {jsonrpc_uri, secret_token, refresh_interval} = self.aria2Store;
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

function aria2RPCStatus(server, indicate, onstart, onfinish) {
    return new Promise(resolve => {
        aria2RPCCall({method: 'aria2.tellActive'}, result => {
            var active = result.map(({gid}) => gid);
            indicate(active.length + '');
            var socket = new WebSocket(server.replace('http', 'ws'));
            socket.onmessage = event => {
                var {method, params: [{gid}]} = JSON.parse(event.data);
                var index = active.indexOf(gid);
                method === 'aria2.onDownloadStart' ? index === -1 && active.push(gid) && onstart(gid):
                    method !=='aria2.onBtDownloadComplete' && index !== -1 && active.splice(index, 1) && onfinish(gid);
                indicate(active.length + '') ?? resolve(socket);
            };
        }, error => indicate());
    });
}
