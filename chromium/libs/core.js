var aria2Start = chrome.i18n.getMessage('download_start');
var aria2Complete = chrome.i18n.getMessage('download_complete');

async function aria2DownloadUrls(url, options = {}) {
    var urls = Array.isArray(url) ? url : [url];
    var message = '';
    var sessions = urls.map((url) => {
        message += `${url}\n`;
        return ['aria2.addUri', [url], options];
    });
    await aria2RPC.batch(sessions);
    await aria2WhenStart(message);
}

async function aria2DownloadJSON(json, origin) {
    var jsons = Array.isArray(json) ? json : [json];
    var message = '';
    var sessions = jsons.map(({url, options}) => {
        if (Array.isArray(url)) {
            message += `${url.join('+')}\n`;
        }
        else {
            url = [url];
            message += `${url}\n`;
        }
        options = options && origin ? {...origin, ...options} : options ? options : origin ? origin : {};
        return ['aria2.addUri', url, options];
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
