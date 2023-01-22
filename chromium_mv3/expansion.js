chrome.action.onClicked.addListener(tab => {
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
        chrome.action.setPopup({popup: ''});
    }
    else {
        chrome.action.setPopup({popup: 'popup/index.html'});
    }
}

function aria2Update() {
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
    aria2RPC.call('aria2.getGlobalOption').then(result => {
        chrome.action.setBadgeText({text: ''});
    }).catch(error => {
        chrome.action.setBadgeText({text: 'E'});
        chrome.action.setBadgeBackgroundColor({color: '#c33'});
    });
}
