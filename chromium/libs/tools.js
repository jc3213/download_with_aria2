function getHostname(url) {
    var si = url.indexOf('://');
    var result = url.slice(si + 3);
    var ei = result.indexOf('/');
    var hostname = result.slice(0, ei);
    var ui = hostname.indexOf('@');
    if (ui !== -1) {
        return hostname.slice(ui + 1);
    }
    return hostname;
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

function aria2NewDownload(slim) {
    return new Promise(async resolve => {
        var {top, left, height, width} = await getCurrentWindow();
        var url = '/session/index.html';
        if (slim) {
            url += '?slim_mode';
            top += (height - 343) / 2 | 0;
            height = 343;
        }
        else {
            top += (height - 726) / 2 | 0;
            height = 726;
        }
        left += (width - 740) / 2 | 0;
        chrome.windows.create({
            type: 'popup',
            url,
            width: 680,
            height,
            left,
            top
        }, resolve);
    });
}
