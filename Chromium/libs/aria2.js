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
                method === 'aria2.onDownloadStart' ? index === -1 && active.push(gid) && aria2Notification('download_start', gid) :
                    method !=='aria2.onBtDownloadComplete' && index !== -1 && active.splice(index, 1) && method === 'aria2.onDownloadComplete' && aria2Notification('download_complete', gid);
                worker(active.length + '');
            };
        }, error => worker('E'));
    });
}

function aria2Notification(action, gid) {
    if (aria2Store[action] === '1') {
        aria2RPCCall({method: 'aria2.tellStatus', params: [gid]}, ({bittorrent, files: [{path, uris}], totalLength, dir}) => {
            chrome.runtime.getPlatformInfo(({os}) => {
                var title = chrome.i18n.getMessage(action) + ' GID#' + gid;
                var name = getDownloadName(bittorrent, path, uris);
                var slash = os === 'win' ? '\\' : '/';
                var message = action === 'download_start' ? name : dir + slash + name + ' (' + getFileSize(totalLength) + ')';
                chrome.notifications.create({type: 'basic', iconUrl: '/icons/icon48.png', title, message});
            });
        });
    }
}
