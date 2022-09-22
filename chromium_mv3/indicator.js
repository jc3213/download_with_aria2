function aria2Status() {
    aria2RPC.message('aria2.getGlobalOption').then(result => {
        chrome.action.setBadgeText({text: 'R'});
        chrome.action.setBadgeBackgroundColor({color: '#33c'});
    }).catch(error => {
        chrome.action.setBadgeText({text: 'E'});
        chrome.action.setBadgeBackgroundColor({color: '#c33'});
    });
}
