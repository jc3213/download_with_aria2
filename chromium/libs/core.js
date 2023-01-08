var aria2Start = chrome.i18n.getMessage('download_start');
var aria2Complete = chrome.i18n.getMessage('download_complete');

async function aria2DownloadUrls(urls, options) {
    if (!Array.isArray(urls)) {
        urls = [urls];
    }
    var message = '';
    var sessions = urls.map(url => {
        message += url + '\n';
        if (options) {
            return {method: 'aria2.addUri', params: [[url], options]};
        }
        else {
            return {method: 'aria2.addUri', params: [[url]]};
        }
    });
    await aria2RPC.batch(sessions);
    await aria2WhenStart(message);
}

async function aria2DownloadJSON(json, origin) {
    if (!Array.isArray(json)) {
        json = [json];
    }
    if (json[0].url === undefined) {
        throw new Error('wrong JSON sytanx, "url" is required!');
    }
    var message = '';
    var sessions = json.map(entry => {
        var {url, options} = entry;
        message += url + '\n';
        if (options) {
            if (origin) {
                options = {...origin, ...options};
            }
            return {method: 'aria2.addUri', params: [[url], options]};
        }
        else {
            if (origin) {
                return {method: 'aria2.addUri', params: [[url], origin]};
            }
            else {
                return {method: 'aria2.addUri', params: [[url]]};
            }
        }
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
            iconUrl: '/icons/icon48.png',
            title,
            message
        }, resolve);
    });
}
