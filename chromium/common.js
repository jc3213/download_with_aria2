function aria2StartUp() {
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
    aria2RPC.message('aria2.tellActive').then(result => {
        var active = result.map(({gid}) => gid);
        chrome.browserAction.setBadgeText({text: active.length === 0 ? '' : active.length + ''});
        chrome.browserAction.setBadgeBackgroundColor({color: '#3cc'});
        aria2Socket = new WebSocket(aria2Store['jsonrpc_uri'].replace('http', 'ws'));
        aria2Socket.onmessage = event => {
            var {method, params: [{gid}]} = JSON.parse(event.data);
            if (method !== 'aria2.onBtDownloadComplete') {
                if (method === 'aria2.onDownloadStart') {
                    if (active.indexOf(gid) === -1) {
                        active.push(gid);
                    }
                }
                else {
                    active.splice(active.indexOf(gid), 1);
                }
                chrome.browserAction.setBadgeText({text: active.length === 0 ? '' : active.length + ''});
            }
        };
    }).catch(error => {
        chrome.browserAction.setBadgeText({text: 'E'});
        chrome.browserAction.setBadgeBackgroundColor({color: '#c33'});
    });
}

function aria2Update() {
    self.aria2Socket && aria2Socket.readyState === 1 && aria2Socket.close();
    aria2StartUp();
}

function getFileExtension(filename) {
    return filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
}

function getCaptureFilter(hostname, type, size) {
    return aria2Store['capture_exclude'].find(host => hostname.endsWith(host)) ? false :
        aria2Store['capture_reject'].includes(type) ? false :
        aria2Store['capture_mode'] === '2' ? true :
        aria2Store['capture_include'].find(host => hostname.endsWith(host)) ? true :
        aria2Store['capture_resolve'].includes(type) ? true :
        aria2Store['capture_size'] > 0 && size >= aria2Store['capture_size'] ? true : false;
}
