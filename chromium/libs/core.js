var aria2Start = chrome.i18n.getMessage('download_start');
var aria2Complete = chrome.i18n.getMessage('download_complete');

function aria2DownloadUrl(url, options) {
    return aria2RPC.call('aria2.addUri', [[url], options]);
}

function aria2DownloadMetalink(metalink, options) {
    return aria2RPC.call('aria2.addMetalink', [metalink, options]);
}

function aria2DownloadTorrent(torrent) {
    return aria2RPC.call('aria2.addTorrent', [torrent]);
}

function aria2BatchDownload(urls, options) {
    var message = '';
    var sessions = urls.map(url => {
        message += url + '\n';
        return {method: 'aria2.addUri', params: [[url], aria2Global]};
    });
    aria2WhenStart(message);
    return aria2RPC.batch(sessions);
}

function aria2DownloadJSON(json, origin) {
    if (!Array.isArray(json)) {
        json = [json];
    }
    if (json[0].url === undefined) {
        return;
    }
    var message = '';
    var sessions = json.map(entry => {
        var {url, options} = entry;
        message += url + '\n';
        if (options) {
            options = {...origin, ...options};
        }
        else {
            options = origin;
        }
        return {method: 'aria2.addUri', params: [[url], options]};
    });
    aria2WhenStart(message);
    return aria2RPC.batch(sessions);
}

function aria2WhenStart(message) {
    if (aria2Store['notify_start']) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: '/icons/icon48.png',
            message,
            title: aria2Start
        });
    }
}

function aria2WhenComplete(message) {
    if (aria2Store['notify_complete']) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: '/icons/icon48.png',
            message,
            title: aria2Complete
        });
    }
}
