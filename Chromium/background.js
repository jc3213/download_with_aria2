chrome.contextMenus.create({
    title: chrome.i18n.getMessage('extension_name'),
    id: 'downwitharia2',
    contexts: ['link']
});

chrome.contextMenus.onClicked.addListener(info => {
    if (info.menuItemId === 'downwitharia2') {
        downloadWithAria2({url: info.linkUrl, referer: info.pageUrl, domain: getDomainFromUrl(info.pageUrl)});
    }
});

chrome.browserAction.setBadgeBackgroundColor({color: '#3cc'});

chrome.downloads.onDeterminingFilename.addListener(item => {
    if (aria2RPC.capture['mode'] === '0' || item.finalUrl.startsWith('blob') || item.finalUrl.startsWith('data')) {
        return;
    }

    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
        var url = item.finalUrl;
        var referer = item.referrer && item.referrer !== 'about:blank' ? item.referrer : tabs[0].url;
        var domain = getDomainFromUrl(referer);
        var filename = item.filename;

        if (captureDownload(domain, getFileExtension(filename), item.fileSize)) {
            chrome.downloads.cancel(item.id, () => {
                chrome.downloads.erase({id: item.id}, () => {
                    downloadWithAria2({url, referer, domain, filename});
                });
            });
        }
    });
});

function captureDownload(domain, fileExt, fileSize) {
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
    if (aria2RPC.capture['fileSize'] > 0 && fileSize >= aria2RPC.capture['fileSize']) {
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

function getFileExtension(filename) {
    return filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
}

function aria2RPCClient() {
    aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.getGlobalStat', params: [token]},
    global => {
        chrome.browserAction.setBadgeText({text: global.numActive === '0' ? '' : global.numActive});
    },
    error => {
        showNotification(error);
        clearInterval(aria2KeepAlive);
    });
}
