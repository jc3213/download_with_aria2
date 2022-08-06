function getHostname(url) {
    try {
        return new URL(url).hostname;
    }
    catch {
        return 'about:blank';
    }
}

function getDownloadName(bittorrent, [{path, uris}]) {
    if (bittorrent && bittorrent.info) {
        return bittorrent.info.name;
    }
    else if (path) {
        return path.slice(path.lastIndexOf('/') + 1);
    }
    else {
        return uris[0].uri;
    }
}

function showNotification(message = '') {
    if (aria2Store['show_notification'] === '1') {
        chrome.notifications.create({
            type: 'basic',
            title: aria2Store['jsonrpc_uri'],
            iconUrl: '/icons/icon48.png',
            message
        });
    }
}
