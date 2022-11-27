var aria2Start = chrome.i18n.getMessage('download_start');
var aria2Complete = chrome.i18n.getMessage('download_complete');

function getHostname(url) {
    var si = url.indexOf('//');
    if (si === -1) {
        return 'about:blank';
    }
    var hostname = url.slice(si + 2);
    var ei = hostname.indexOf('/');
    hostname = hostname.slice(0, ei);
    var pi = hostname.lastIndexOf(':');
    if (hostname.indexOf(':') === pi) {
        if (pi !== -1) {
            return hostname.slice(0, pi);
        }
        return hostname;
    }
    else {
        if (hostname[pi - 1] === ']') {
            return hostname.slice(0, pi);
        }
        return hostname;
    }
}

function getDownloadName(bittorrent, [{path, uris}]) {
    if (bittorrent && bittorrent.info) {
        return bittorrent.info.name;
    }
    else if (path) {
        return path.slice(path.lastIndexOf('/') + 1);
    }
    else if (uris[0]) {
        return uris[0].uri;
    }
    return '???';
}

function getCurrentWindow() {
    return new Promise(resolve => {
        chrome.windows.getCurrent(resolve);
    });
}

function aria2NewSession(size) {
    return new Promise(async resolve => {
        var {top, left, height, width} = await getCurrentWindow();
        var offset = size === 'full' ? 770 : 360;
        top += (height - offset) / 2 | 0;
        left += (width - 760) / 2 | 0;
        chrome.windows.create({
            url: '/session/index.html?' + size,
            type: 'popup',
            height: offset,
            width: 680,
            top,
            left
        }, resolve);
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
