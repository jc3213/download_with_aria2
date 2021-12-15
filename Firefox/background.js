browser.runtime.getPlatformInfo(platform => {
    aria2Platform = platform.os
});

browser.contextMenus.create({
    title: browser.i18n.getMessage('extension_name'),
    id: 'downwitharia2firefox',
    contexts: ['link']
});

browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'downwitharia2firefox') {
        startDownload({url: info.linkUrl, referer: info.pageUrl, storeId: tab.cookieStoreId, domain: getDomainFromUrl(info.pageUrl)});
    }
});

browser.browserAction.setBadgeBackgroundColor({color: '#3cc'});

browser.downloads.onCreated.addListener(async item => {
    if (aria2RPC.capture['mode'] === '0' || item.url.startsWith('blob') || item.url.startsWith('data')) {
        return;
    }

    var tabs = await browser.tabs.query({active: true, currentWindow: true});
    var url = item.url;
    var referer = item.referrer && item.referrer !== 'about:blank' ? item.referrer : tabs[0].url;
    var domain = getDomainFromUrl(referer);
    var filename = getFileNameFromUri(item.filename);
    var folder = aria2RPC.folder['mode'] === '1' ? item.filename.slice(0, item.filename.indexOf(filename)) : aria2RPC.folder['mode'] === '2' ? aria2RPC.folder['uri'] : null;
    var storeId = tabs[0].cookieStoreId;

    if (await captureDownload(domain, getFileExtension(filename), url)) {
        browser.downloads.cancel(item.id).then(() => {
            browser.downloads.erase({id: item.id}).then(() => {
                startDownload({url, referer, domain, filename, folder, storeId});
            });
        }).catch(error => showNotification('Download is already complete'));
    }
});

async function startDownload({url, referer, domain, filename, folder, storeId}, options = {}) {
    var cookies = await browser.cookies.getAll({url, storeId});
    options['header'] = ['Cookie:', 'Referer: ' + referer, 'User-Agent: ' + aria2RPC['useragent']];
    cookies.forEach(cookie => options['header'][0] += ' ' + cookie.name + '=' + cookie.value + ';');
    if (folder) {
        options['dir'] = folder;
    }
    if (filename) {
        options['out'] = filename;
    }
    if (aria2RPC.proxy['resolve'].includes(domain)) {
        options['all-proxy'] = aria2RPC.proxy['uri'];
    }
    downloadWithAria2(url, options);
}

async function captureDownload(domain, fileExt, url) {
    if (aria2RPC.capture['reject'].includes(domain)) {
        return false;
    }
    if (aria2RPC.capture['mode'] === '2') {
        return true;
    }
    if (aria2RPC.capture['resolve'].includes(domain)) {
        return true;
    }
    if (aria2RPC.capture['fileExt'].includes(fileExt)) {
        return true;
    }
// Use Fetch to resolve fileSize untill Mozilla fixes downloadItem.fileSize
// Some websites will not support this workaround due to their access policy
// See https://bugzilla.mozilla.org/show_bug.cgi?id=1666137 for more details
    if (aria2RPC.capture['fileSize'] > 0 && await fetch(url, {method: 'HEAD'}).then(response => response.headers.get('content-length')) >= aria2RPC.capture['fileSize']) {
        return true;
    }
    return false;
}

function getDomainFromUrl(url) {
    var host = /^https?:\/\/([^\/]+)\//.exec(url)[1];
    var hostname = /:\d{2,5}$/.test(host) ? host.slice(0, host.lastIndexOf(':')) : host;
    if (hostname.includes(':')) {
        return hostname.slice(1, -1);
    }
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$|^[^\.]+\.[^\.]+$/.test(hostname)) {
        return hostname;
    }
    var suffix = /([^\.]+)\.([^\.]+)\.([^\.]+)$/.exec(hostname);
    var gSLD = ['com', 'net', 'org', 'edu', 'gov', 'co', 'ne', 'or', 'me'];
    return gSLD.includes(suffix[2]) ? suffix[1] + '.' + suffix[2] + '.' + suffix[3] : suffix[2] + '.' + suffix[3];
}

function getFileNameFromUri(uri) {
    var index = aria2Platform === 'win' ? uri.lastIndexOf('\\') : uri.lastIndexOf('/');
    return uri.slice(index + 1);
}

function getFileExtension(filename) {
    return filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
}

function aria2RPCClient() {
    aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.getGlobalStat', params: [aria2RPC.jsonrpc['token']]},
    global => browser.browserAction.setBadgeText({text: global.numActive === '0' ? '' : global.numActive}),
    showNotification, true);
}
