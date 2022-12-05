function aria2Update() {
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
    aria2RPC.call('aria2.getGlobalOption').then(result => {
        chrome.action.setBadgeText({text: ''});
    }).catch(error => {
        chrome.action.setBadgeText({text: 'E'});
        chrome.action.setBadgeBackgroundColor({color: '#c33'});
    });
}
