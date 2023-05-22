var aria2NewDL = '/pages/newdld/newdld.html';

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

function getDownloadName(gid, bittorrent, [{path, uris}]) {
    return bittorrent?.info?.name ?? path?.slice(path.lastIndexOf('/') + 1) ?? uris[0].uri ?? gid;
}

function getCurrentWindow() {
    return new Promise(resolve => {
        chrome.windows.getCurrent(resolve);
    });
}

function getNewWindow(url, offsetWidth, offsetHeight) {
    return new Promise(async resolve => {
        var {width, height, left, top} = await getCurrentWindow();
        top += (height - offsetHeight) / 2 | 0;
        left += (width - offsetWidth) / 2 | 0;
        chrome.windows.create({
            type: 'popup',
            url,
            width: offsetWidth,
            height: offsetHeight,
            left,
            top
        }, popup => {
            var {id} = popup.tabs[0];
            resolve(id);
        });
    });
}

function aria2NewDownload(slim) {
    if (slim) {
        return getNewWindow(aria2NewDL + '?slim_mode', 640, 308);
    }
    return getNewWindow(aria2NewDL, 640, 610);
}
