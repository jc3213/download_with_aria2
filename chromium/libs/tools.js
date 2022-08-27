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

function showNotification(message, when) {
    if (when === 'start' && ['1', '3'].includes(aria2Store['show_notification'])) {
        var title = aria2Store['jsonrpc_uri'];
    }
    else if (when === 'complete' && ['2', '3'].includes(aria2Store['show_notification'])) {
        title = chrome.i18n.getMessage('download_complete');
    }
    else {
        return;
    }
    chrome.notifications.create({
        type: 'basic',
        title,
        iconUrl: '/icons/icon48.png',
        message
    });
}
