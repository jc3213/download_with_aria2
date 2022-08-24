async function downloadUrl(url, options) {
    var gid = await aria2RPC.message('aria2.addUri', [[url], options]);
    addSession(gid);
    showNotification(url, 'start');
}

async function downloadTorrent(file, options) {
    var torrent = await promiseFileReader(file, 'base64');
    var gid = await aria2RPC.message('aria2.addTorrent', [torrent]);
    addSession(gid);
}

async function downloadMetalink(file, options) {
    var metalink = await promiseFileReader(file, 'base64');
    await aria2RPC.message('aria2.addMetalink', [metalink, options]);
    aria2RPC.message('aria2.tellWaiting', [0, 999]).then(waiting => waiting.forEach(printSession));
}

function downloadJSON(json, options) {
    var {url, filename, referer} = json;
    if (filename) {
        options['out'] = filename;
    }
    if (referer) {
        options['referer'] = referer;
    }
    downloadUrl(url, options);
}

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
        title = chrome.i18n.getMessage('complete_title');
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
