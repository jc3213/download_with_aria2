function getHostname(url) {
    try {
        return new URL(url).hostname;
    }
    catch {
        return 'about:blank';
    }
}

function getDownloadName(bittorrent, [{path, uris}]) {
    return bittorrent && bittorrent.info ? bittorrent.info.name :
        path ? path.slice(path.lastIndexOf('/') + 1) : uris[0].uri;
}

function showNotification(message = '') {
    chrome.notifications.create({
        type: 'basic',
        title: aria2Store['jsonrpc_uri'],
        iconUrl: '/icons/icon48.png',
        message
    });
}
