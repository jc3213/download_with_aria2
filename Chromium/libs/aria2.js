var aria2Alive = -1;

function aria2Message(json) {
    var make = ({method, params = []}) => ({id: '', jsonrpc: 2, method, params: [aria2Store['secret_token'], ... params]});
    var data = Array.isArray(json) ? {id: '', jsonrpc: 2, method: 'system.multicall', params: [json.map(make)]} : make(json);
    return JSON.stringify(data);
}

function aria2RPCCall(json, resolve, reject, alive) {
    var message = aria2Message(json);
    var worker = aria2Store['jsonrpc_uri'].startsWith('http') ? aria2XMLRequest : aria2WebSocket;
    alive && (aria2Alive = setInterval(() => worker(message, resolve, reject), aria2Store['refresh_interval']));
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

function aria2RPCStatus(indicate, onstart, onfinish) {
    return new Promise(resolve => {
        aria2RPCCall({method: 'aria2.tellActive'}, result => {
            var active = result.map(({gid}) => gid);
            indicate(active.length + '');
            var socket = new WebSocket(aria2Store['jsonrpc_uri'].replace('http', 'ws'));
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
