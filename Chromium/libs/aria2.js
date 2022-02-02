function aria2RPCCall(json, resolve, reject, alive) {
    var message = JSON.stringify( json.method ? {id: '', jsonrpc: 2, method: json.method, params: [aria2Store['secret_token']].concat(json.params ?? [])} :
        {id: '', jsonrpc: 2, method: 'system.multicall', params: [json.map( ({method, params = []}) => ({id: '', jsonrpc: 2, methodName: method, params: [aria2Store['secret_token'], ...params]}) )]} );
    var worker = aria2Store['jsonrpc_uri'].startsWith('http') ? aria2XMLRequest : aria2WebSocket;
    alive && setInterval(() => worker(message, resolve, reject), aria2Store['refresh_interval']);
    worker(message, resolve, reject);
}

function aria2XMLRequest(body, resolve, reject) {
    fetch(aria2Store['jsonrpc_uri'], {method: 'POST', body}).then(response => response.json())
        .then(({result, error}) => result ? typeof resolve === 'function' && resolve(result) : typeof reject === 'function' && reject())
        .catch(reject);
}

function aria2WebSocket(message, resolve, reject) {
    var socket = new WebSocket(aria2Store['jsonrpc_uri']);
    socket.onopen = event => socket.send(message);
    socket.onclose = reject;
    socket.onmessage = event => {
        var {result, error} = JSON.parse(event.data);
        result ? typeof resolve === 'function' && resolve(result) : typeof reject === 'function' && reject();
        socket.onclose = socket.close();
    };
}

function aria2RPCStatus(worker) {
    return new Promise(resolve => {
        aria2RPCCall({method: 'aria2.tellActive'}, result => {
            var active = result.map(({gid}) => gid);
            var socket = new WebSocket(aria2Store['jsonrpc_uri'].replace('http', 'ws'));
            worker(active.length + '') ?? resolve(socket);
            socket.onmessage = event => {
                var {method, params: [{gid}]} = JSON.parse(event.data);
                var index = active.indexOf(gid);
                method === 'aria2.onDownloadStart' ? index === -1 && active.push(gid) && console.log('Download start!', gid) :
                    method !=='aria2.onBtDownloadComplete' && index !== -1 && active.splice(index, 1) && method === 'aria2.onDownloadComplete' && console.log('Download complete!', gid);
                worker(active.length + '');
            };
        }, error => worker('E'));
    });
}
