var aria2Complete = chrome.i18n.getMessage('download_complete');

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

function aria2NewSession(param, offset) {
    return new Promise(resolve => {
        var {height, width} = screen;
        chrome.windows.create({
            url: '/session/index.html?' + param,
            type: 'popup',
            height: offset,
            width: 720,
            top: (height - offset) / 2,
            left: width / 2 - 360
        }, window => {
            var tab = window.tabs[0];
            resolve(tab.id);
        });
    });
}

function aria2WhenStart(message) {
    if (aria2Store['notify_start'] === '1') {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: '/icons/icon48.png',
            message,
            title: aria2Store['jsonrpc_uri']
        });
    }
}

function aria2WhenComplete(message) {
    if (aria2Store['notify_complete'] === '1') {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: '/icons/icon48.png',
            message,
            title: aria2Complete
        });
    }
}
