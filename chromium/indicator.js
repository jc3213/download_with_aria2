function aria2StartUp() {
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
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
    // Hotfix
    function hotfixNotify(start, complete) {
        aria2Store['notify_start'] = start;
        aria2Store['notify_complete'] = complete;
        delete aria2Store['show_notification'];
        chrome.storage.local.set(aria2Store);
    }
    if (aria2Store['show_notification'] === '0') {
        hotfixNotify('0', '0');
    }
    else if (aria2Store['show_notification'] === '1') {
        hotfixNotify('1', '0');
    }
    else if (aria2Store['show_notification'] === '2') {
        hotfixNotify('0', '1');
    }
    else if (aria2Store['show_notification'] === '3') {
        hotfixNotify('1', '1');
    }
}

function aria2Update() {
    if (self.aria2Socket && aria2Socket.readyState === 1) {
        aria2Socket.close();
    }
    aria2StartUp();
}
