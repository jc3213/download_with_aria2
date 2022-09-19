function aria2StartUp() {
    aria2RPC = new JSLib_Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
    aria2RPC.message('aria2.tellActive').then(result => {
        var active = result.map(({gid}) => gid);
        chrome.browserAction.setBadgeText({text: active.length === 0 ? '' : active.length + ''});
        chrome.browserAction.setBadgeBackgroundColor({color: '#3cc'});
        aria2Socket = new WebSocket(aria2Store['jsonrpc_uri'].replace('http', 'ws'));
        aria2Socket.onmessage = async event => {
            var {method, params: [{gid}]} = JSON.parse(event.data);
            if (method !== 'aria2.onBtDownloadComplete') {
                if (method === 'aria2.onDownloadStart') {
                    if (active.indexOf(gid) === -1) {
                        active.push(gid);
                    }
                }
                else {
                    active.splice(active.indexOf(gid), 1);
                    if (method === 'aria2.onDownloadComplete') {
                        var {bittorrent, files} = await aria2RPC.message('aria2.tellStatus', [gid]);
                        var name = getDownloadName(bittorrent, files);
                        aria2WhenComplete(name);
                    }
                }
            }
            chrome.browserAction.setBadgeText({text: active.length === 0 ? '' : active.length + ''});
        };
    }).catch(error => {
        chrome.browserAction.setBadgeText({text: 'E'});
        chrome.browserAction.setBadgeBackgroundColor({color: '#c33'});
    });
}

function aria2Update() {
    if (self.aria2Socket && aria2Socket.readyState === 1) {
        aria2Socket.close();
    }
    aria2StartUp();
}
