chrome.runtime.onInstalled.addListener(async ({reason}) => {
    if (reason === 'install') {
        var text = await fetch('/options.json');
        var json = await text.json();
        chrome.storage.local.set(json);
    }
});

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
}

function aria2Update() {
    if (self.aria2Socket && aria2Socket.readyState === 1) {
        aria2Socket.close();
    }
    aria2StartUp();
}

function getFileExtension(filename) {
    return filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
}

function getCaptureFilter(hostname, type, size) {
    if (aria2Store['capture_exclude'].find(host => hostname.endsWith(host))) {
        return false;
    }
    else if (aria2Store['capture_reject'].includes(type)) {
        return false;
    }
    else if (aria2Store['capture_mode'] === '2') {
        return true;
    }
    else if (aria2Store['capture_include'].find(host => hostname.endsWith(host))) {
        return true;
    }
    else if (aria2Store['capture_resolve'].includes(type)) {
        return true;
    }
    else if (aria2Store['capture_size'] > 0 && size >= aria2Store['capture_size']) {
        return true;
    }
    else {
        return false;
    }
}

function getProxyServer(hostname) {
    if (aria2Store['proxy_mode'] === '1' && aria2Store['proxy_include'].find(host => hostname.endsWith(host))) {
        return aria2Store['proxy_server'];
    }
    else if (aria2Store['proxy_mode'] === '2') {
        return aria2Store['proxy_server'];
    }
    else {
        return null;
    }
}

function getRequestHeaders(cookies) {
    var result = 'Cookie:';
    cookies.forEach(cookie => {
        var {name, value} = cookie;
        result += ' ' + name + '=' + value + ';';
    });
    return [result];
}

function getDownloadFolder() {
    if (aria2Store['folder_mode'] === '1' && aria2Store['folder_path']) {
        return aria2Store['folder_path'];
    }
    else {
        return null;
    }
}
