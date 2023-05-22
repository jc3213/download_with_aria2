var aria2Start = chrome.i18n.getMessage('download_start');
var aria2Complete = chrome.i18n.getMessage('download_complete');

async function aria2DownloadUrls(urls, options) {
    if (!Array.isArray(urls)) {
        urls = [urls];
    }
    var message = '';
    var sessions = urls.map(url => {
        message += url + '\n';
        var params = options ? [[url], options] : [[url]];
        return {method: 'aria2.addUri', params};
    });
    await aria2RPC.batch(sessions);
    await aria2WhenStart(message);
}

async function aria2DownloadJSON(json, origin) {
    if (!Array.isArray(json)) {
        json = [json];
    }
    var message = '';
    var sessions = json.map(entry => {
        var {url, options} = entry;
        if (!url) {
            throw new SyntaxError('Wrong JSON format: "url" is required!');
        }
        message += url + '\n';
        var params = options && origin ? [[url], {...origin, ...options}] :
            options ? [[url], options] :
            origin ? [[url], origin] : [[url]];
        return {method: 'aria2.addUri', params};
    });
    await aria2RPC.batch(sessions);
    await aria2WhenStart(message);
}

function aria2WhenStart(message) {
    if (aria2Store['notify_start']) {
        return getNotification(aria2Start, message);
    }
}

function aria2WhenComplete(message) {
    if (aria2Store['notify_complete']) {
        return getNotification(aria2Complete, message);
    }
}

function getNotification(title, message) {
    return new Promise(resolve => {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: '/icons/48.png',
            title,
            message
        }, resolve);
    });
}
