function getUrlComponents(url) {
    var pi = url.indexOf('://');
    if (pi === -1) {
        throw new URIError('Invalid URL!');
    }
    var protocol = url.slice(0, pi);
    var result = url.slice(pi + 3);
    var hi = result.indexOf('/');
    var host = result.slice(0, hi);
    var po = host.lastIndexOf(':');
    if (po === -1) {
        var hostname = host;
        var port = '';
    }
    else if (host[0] === '[') {
        if (host[po - 1] === ']') {
            var hostname = host.slice(0, po);
            var port = host.slice(po + 1);
        }
        else {
            var hostname = host;
            var port = '';
        }
    }
    else {
        var hostname = host.slice(0, po);
        var port = host.slice(po + 1);
    }
    return {protocol, host, hostname, port};
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
