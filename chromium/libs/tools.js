function getHostname(url) {
    var si = url.indexOf('//');
    if (si === -1) {
        return '???';
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

function aria2NewDownload(size) {
    return new Promise(async resolve => {
        var {top, left, height, width} = await getCurrentWindow();
        var offset = size === 'slim' ? 343 : 726;
        top += (height - offset) / 2 | 0;
        left += (width - 740) / 2 | 0;
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
