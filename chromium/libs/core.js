var aria2Start = chrome.i18n.getMessage('download_start');
var aria2Complete = chrome.i18n.getMessage('download_complete');

async function aria2DownloadUrls(url, options = {}) {
    var urls = Array.isArray(url) ? url : [url];
    var message = '';
    var session = urls.map((url) => {
        message += url + '\n';
        return {method: 'aria2.addUri', params: [[url], options]};
    });
    await aria2RPC.call(...session);
    await aria2WhenStart(message);
}

async function aria2DownloadJSON(json, origin) {
    var jsons = Array.isArray(json) ? json : [json];
    var message = '';
    var session = jsons.map(({url, options}) => {
        if (Array.isArray(url)) {
            message += url.join('+') + '\n';
        }
        else {
            url = [url];
            message += url + '\n';
        }
        options = options && origin ? {...origin, ...options} : options ? options : origin ? origin : {};
        return {method: 'aria2.addUri', params: [url, options]};
    });
    await aria2RPC.call(...session);
    await aria2WhenStart(message);
}

function aria2WhenStart(message) {
    if (aria2Storage['notify_start']) {
        return getNotification(aria2Start, message);
    }
}

function aria2WhenComplete(message) {
    if (aria2Storage['notify_complete']) {
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
