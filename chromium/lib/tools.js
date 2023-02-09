function getHostname(url) {
    var si = url.indexOf('://');
    var result = url.slice(si + 3);
    var ei = result.indexOf('/');
    var host = result.slice(0, ei);
    var ui = host.indexOf('@');
    if (ui !== -1) {
        return host.slice(ui + 1);
    }
    return host;
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

function getNewPopup(url, offsetHeight) {
    return new Promise(async resolve => {
        var {width, height, left, top} = await getCurrentWindow();
        top += (height - offsetHeight) / 2 | 0;
        left += (width - 740) / 2 | 0;
        chrome.windows.create({
            type: 'popup',
            url,
            width: 680,
            height: offsetHeight,
            left,
            top
        }, popup => {
            var {tabs} = popup;
            var {id} = tabs[0];
            resolve(id);
        });
    });
}

function aria2NewDownload(slim) {
    if (slim) {
        var url = '/page/newdl.html?slim_mode';
        var height = 343;
    }
    else {
        url = '/page/newdl.html';
        height = 726;
    }
    return getNewPopup(url, height);
}
