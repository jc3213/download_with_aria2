var aria2Start = chrome.i18n.getMessage('download_start');
var aria2Complete = chrome.i18n.getMessage('download_complete');
var aria2MatchKeys = [
    'headers_exclude',
    'proxy_include',
    'capture_include',
    'capture_exclude'
];
var aria2SizeKeys = [
    'min-split-size',
    'disk-cache',
    'max-download-limit',
    'max-overall-download-limit',
    'max-upload-limit',
    'max-overall-upload-limit',
];

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

function getFileSize(bytes) {
    if (isNaN(bytes)) {
        return '??';
    }
    if (bytes < 1024) {
        return bytes;
    }
    if (bytes < 1048576) {
        return (bytes / 10.24 | 0) / 100 + 'K';
    }
    if (bytes < 1073741824) {
        return (bytes / 10485.76 | 0) / 100 + 'M';
    }
    if (bytes < 1099511627776) {
        return (bytes / 10737418.24 | 0) / 100 + 'G';
    }
    return (bytes / 10995116277.76 | 0) / 100 + 'T';
}

function getRequestCookies(url, storeId) {
    if (storeId) {
        return browser.cookies.getAll({url, storeId, firstPartyDomain: null});
    }
    return new Promise((resolve) => chrome.cookies.getAll({url}, resolve));
}

function getSessionName(gid, bittorrent, [{path, uris}]) {
    return bittorrent?.info?.name || path?.slice(path.lastIndexOf('/') + 1) || uris[0]?.uri || gid;
}

function getHostname(url) {
    var temp = url.slice(url.indexOf('://') + 3);
    var host = temp.slice(0, temp.indexOf('/'));
    return host.slice(host.indexOf('@') + 1);
}

function getFileExtension(filename) {
    var fileext = filename.slice(filename.lastIndexOf('.') + 1);
    return fileext.toLowerCase();
}

function getNotification(title, message) {
    return new Promise(resolve => {
        chrome.notifications.create({
            title, message,
            type: 'basic',
            iconUrl: '/icons/48.png'
        }, resolve);
    });
}
