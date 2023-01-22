var aria2Socket;

chrome.browserAction.onClicked.addListener(tab => {
    chrome.tabs.query({currentWindow: true}, tabs => {
        try {
            var {id} = tabs.find(tab => tab.url.includes('popup/index.html?open_in_tab'));
            chrome.tabs.update(id, {active: true});
        }
        catch (error) {
            chrome.tabs.create({active: true, url: 'popup/index.html?open_in_tab'});
        }
    });
});

function aria2Manager() {
    if (aria2Store['newtab_manager']) {
        chrome.browserAction.setPopup({popup: ''});
    }
    else {
        chrome.browserAction.setPopup({popup: 'popup/index.html'});
    }
}

function aria2StartUp() {
    if (aria2Socket && aria2Socket.readyState === 1) {
        aria2Socket.close();
    }
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
    aria2RPC.call('aria2.tellActive').then(result => {
        chrome.browserAction.setBadgeBackgroundColor({color: '#3cc'});
        var active = result.map(({gid}) => gid);
        aria2Badge(active.length);
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
                        var {bittorrent, files} = await aria2RPC.call('aria2.tellStatus', [gid]);
                        var name = getDownloadName(bittorrent, files);
                        aria2WhenComplete(name);
                    }
                }
            }
            aria2Badge(active.length);
        };
    }).catch(error => {
        chrome.browserAction.setBadgeBackgroundColor({color: '#c33'});
        aria2Badge('E');
    });
}

function aria2Badge(text) {
    if (!isNaN(text)) {
        if (text === 0) {
            text = '';
        }
        else {
            text += '';
        }
    }
    chrome.browserAction.setBadgeText({text});
}
