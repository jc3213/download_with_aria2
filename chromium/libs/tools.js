var notification = {
    type: 'basic',
    iconUrl: '/icons/icon48.png'
};

function getHostname(url) {
    try {
        return new URL(url).hostname;
    }
    catch {
        return 'about:blank';
    }
}

function getCurrentTabUrl() {
    return new Promise(resolve => {
        chrome.tabs.query({active: true, currentWindow: true}, tabs => {
            var {url} = tabs[0];
            resolve(url);
        });
    });
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

function aria2WhenStart(message) {
    if (aria2Store['notify_start'] === '1') {
        chrome.notifications.create({
            ...notification,
            message,
            title: aria2Store['jsonrpc_uri']
        });
    }
}

function aria2WhenComplete(message) {
    if (aria2Store['notify_complete'] === '1') {
        chrome.notifications.create({
            ...notification,
            message,
            title: chrome.i18n.getMessage('download_complete')
        });
    }
}
