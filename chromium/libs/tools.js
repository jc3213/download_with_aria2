function showNotification(message = '') {
    chrome.notifications.create({
        type: 'basic',
        title: aria2Store['jsonrpc_uri'],
        iconUrl: '/icons/icon48.png',
        message
    });
}
