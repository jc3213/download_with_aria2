var aria2Socket;
var aria2Retry;
var aria2Active;

chrome.browserAction.onClicked.addListener((tab) => {
    chrome.tabs.query({currentWindow: true}, (tabs) => {
        var popup = tabs.find(tab => tab.url.includes(aria2InTab));
        if (popup) {
            chrome.tabs.update(popup.id, {active: true});
        }
        else {
            chrome.tabs.create({active: true, url: aria2Popup + '?open_in_tab'});
        }
    });
});

async function aria2DownloadPrompt(aria2c) {
    if (aria2Storage['download_prompt']) {
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

function aria2TaskManager() {
    if (aria2Storage['manager_newtab']) {
        chrome.browserAction.setPopup({popup: ''});
    }
    else {
        chrome.browserAction.setPopup({popup: aria2Popup});
    }
}

function aria2ClientSetUp() {
    if (aria2Retry) {
        clearTimeout(aria2Retry);
    }
    if (aria2Socket?.readyState === 1) {
        aria2Socket.close();
    }
    aria2RPC = new Aria2(aria2Storage['jsonrpc_uri'], aria2Storage['jsonrpc_token']);
    aria2RPC.call('aria2.tellActive').then((result) => {
        chrome.browserAction.setBadgeBackgroundColor({color: '#3cc'});
        aria2Retry = null;
        aria2Active = result.map(({gid}) => gid);
        aria2ToolbarBadge(aria2Active.length);
        aria2Socket = new WebSocket(aria2Storage['jsonrpc_uri'].replace('http', 'ws'));
        aria2Socket.onmessage = async (event) => {
            var {method, params: [{gid}]} = JSON.parse(event.data);
            var adx = aria2Active.indexOf(gid);
            if (method === 'aria2.onDownloadStart' && adx === -1) {
                aria2Active.push(gid);
            }
            else if (method === 'aria2.onDownloadComplete') {
                var {bittorrent, files} = await aria2RPC.call('aria2.tellStatus', gid);
                var name = getDownloadName(gid, bittorrent, files);
                aria2Active.splice(adx, 1);
                aria2WhenComplete(name);
            }
            else if (method !== 'aria2.onBtDownloadComplete') {
                aria2Active.splice(adx, 1);
            }
            aria2ToolbarBadge(aria2Active.length);
        };
    }).catch((error) => {
        chrome.browserAction.setBadgeBackgroundColor({color: '#c33'});
        aria2ToolbarBadge('E');
        aria2Retry = setTimeout(aria2ClientSetUp, aria2Storage['manager_interval'])
    });
}

function aria2ToolbarBadge(text) {
    if (!isNaN(text)) {
        text = text === 0 ? '' : text + '';
    }
    chrome.browserAction.setBadgeText({text});
}
