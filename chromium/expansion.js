var aria2Socket;
var aria2Retry;
var aria2Active;

chrome.browserAction.onClicked.addListener(tab => {
    chrome.tabs.query({currentWindow: true}, tabs => {
        var tab = tabs.find(tab => tab.url.includes(aria2InTab));
        if (tab) {
            chrome.tabs.update(tab.id, {active: true});
        }
        else {
            chrome.tabs.create({active: true, url: aria2Popup + '?open_in_tab'});
        }
    });
});

async function aria2DownloadPrompt(aria2c) {
    if (aria2Store['download_prompt']) {
        var id = await aria2NewDownload(true);
        aria2Prompt[id] = aria2c;
    }
    else {
        var {url, json, options} = aria2c;
        if (json) {
            aria2DownloadJSON(json, options);
        }
        else if (url) {
            aria2DownloadUrls(url, options);
        }
    }
}

function aria2Manager() {
    if (aria2Store['manager_newtab']) {
        chrome.browserAction.setPopup({popup: ''});
    }
    else {
        chrome.browserAction.setPopup({popup: aria2Popup});
    }
}

function aria2StartUp() {
    if (aria2Retry) {
        clearTimeout(aria2Retry);
    }
    if (aria2Socket && aria2Socket.readyState === 1) {
        aria2Socket.close();
    }
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['jsonrpc_token']);
    aria2RPC.call('aria2.tellActive').then(result => {
        chrome.browserAction.setBadgeBackgroundColor({color: '#3cc'});
        aria2Retry = null;
        aria2Active = result.map(({gid}) => gid);
        aria2Badge(aria2Active.length);
        aria2Socket = new WebSocket(aria2Store['jsonrpc_uri'].replace('http', 'ws'));
        aria2Socket.onmessage = async event => {
            var {method, params: [{gid}]} = JSON.parse(event.data);
            if (method !== 'aria2.onBtDownloadComplete') {
                if (method === 'aria2.onDownloadStart') {
                    if (aria2Active.indexOf(gid) === -1) {
                        aria2Active.push(gid);
                    }
                }
                else {
                    aria2Active.splice(aria2Active.indexOf(gid), 1);
                    if (method === 'aria2.onDownloadComplete') {
                        var {bittorrent, files} = await aria2RPC.call('aria2.tellStatus', [gid]);
                        var name = getDownloadName(gid, bittorrent, files);
                        aria2WhenComplete(name);
                    }
                }
            }
            aria2Badge(aria2Active.length);
        };
    }).catch(error => {
        chrome.browserAction.setBadgeBackgroundColor({color: '#c33'});
        aria2Badge('E');
        aria2Retry = setTimeout(aria2StartUp, aria2Store['manager_interval'])
    });
}

function aria2Badge(text) {
    if (!isNaN(text)) {
        text = text === 0 ? '' : text + '';
    }
    chrome.browserAction.setBadgeText({text});
}
