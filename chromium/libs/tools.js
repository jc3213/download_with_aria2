var aria2NewDL = '/pages/newdld/newdld.html';

function getHostname(url) {
    var temp = url.slice(url.indexOf('://') + 3);
    var host = temp.slice(0, temp.indexOf('/'));
    return host.slice(host.indexOf('@') + 1);
}

function getDownloadName(gid, bittorrent, [{path, uris}]) {
    return bittorrent?.info?.name || path?.slice(path.lastIndexOf('/') + 1) || uris[0]?.uri || gid;
}

function getCurrentWindow() {
    return new Promise(resolve => {
        chrome.windows.getCurrent(resolve);
    });
}

function getNewWindow(url, offsetHeight) {
    return new Promise(async resolve => {
        var {width, height, left, top} = await getCurrentWindow();
        top += (height - offsetHeight) / 2 | 0;
        left += (width - 710) / 2 | 0;
        chrome.windows.create({
            type: 'popup',
            url,
            width: 698,
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
        return getNewWindow(aria2NewDL + '?slim_mode', 307);
    }
    return getNewWindow(aria2NewDL, 502);
}
