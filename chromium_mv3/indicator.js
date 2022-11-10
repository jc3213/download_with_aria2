function aria2Status() {
    aria2RPC.message('aria2.getGlobalOption').catch(error => {
        chrome.action.setBadgeText({text: 'E'});
        chrome.action.setBadgeBackgroundColor({color: '#c33'});
    });
}
