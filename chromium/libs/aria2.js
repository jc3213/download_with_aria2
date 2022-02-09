function aria2RPCCall(method, params = []) {
    var message = JSON.stringify({id: '', jsonrpc: 2, method, params: [aria2Store['secret_token'], ...params]});
    return aria2Store['jsonrpc_uri'].startsWith('http') ? aria2XMLRequest(aria2Store['jsonrpc_uri'], message) : aria2WebSocket(aria2Store['jsonrpc_uri'], message);
}

function aria2XMLRequest(jsonrpc, body) {
    return new Promise((resolve, reject) => {
        fetch(jsonrpc, {method: 'POST', body})
        .then(response => response.json())
        .then(({result, error}) => result ? resolve(result) : reject())
        .catch(reject);
    });
}

function aria2WebSocket(message, message) {
    return new Primise((resolve, reject) => {
        var socket = new WebSocket(aria2Store['jsonrpc_uri']);
        socket.onopen = event => socket.send(message);
        socket.onclose = reject;
        socket.onmessage = event => {
            var {result, error} = JSON.parse(event.data);
            result ? resolve(result) : reject();
            socket.close();
        };
    });
}

function aria2RPCStatus(worker) {
    return new Promise(resolve => {
        aria2RPCCall('aria2.tellActive').then(result => {
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
        }).catch(error => worker('E'));
    });
}
