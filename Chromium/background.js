chrome.contextMenus.create({
    title: chrome.i18n.getMessage('extension_name'),
    id: 'downwitharia2',
    contexts: ['link']
});

chrome.contextMenus.onClicked.addListener(info => {
    startDownload({url: info.linkUrl, referer: info.pageUrl, domain: getDomainFromUrl(info.pageUrl)});
});

chrome.downloads.onDeterminingFilename.addListener(item => {
    if (aria2RPC.capture['mode'] === '0' || item.finalUrl.startsWith('blob') || item.finalUrl.startsWith('data')) {
        return;
    }

    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
        var url = item.finalUrl;
        var referer = item.referrer && item.referrer !== 'about:blank' ? item.referrer : tabs[0].url;
        var domain = getDomainFromUrl(referer);
        var filename = item.filename;

        captureDownload(domain, getFileExtension(filename), item.fileSize) && 
            chrome.downloads.cancel(item.id, () => {
                chrome.downloads.erase({id: item.id}, () => {
                    startDownload({url, referer, domain, filename});
                });
            });
    });
});

function startDownload({url, referer, domain, filename}, options = {}) {
    chrome.cookies.getAll({url}, cookies => {
        options['header'] = ['Cookie:', 'Referer: ' + referer, 'User-Agent: ' + aria2RPC['useragent']];
        cookies.forEach(cookie => options['header'][0] += ' ' + cookie.name + '=' + cookie.value + ';');
        options['out'] = filename;
        options['all-proxy'] = aria2RPC.proxy['resolve'].includes(domain) ? aria2RPC.proxy['uri'] : '';
        aria2RPCCall({method: 'aria2.addUri', params: [[url], options]}, result => showNotification(url), showNotification);
    });
}

function captureDownload(domain, fileExt, fileSize) {
    return aria2RPC.capture['reject'].includes(domain) ? false :
        aria2RPC.capture['mode'] === '2' ? true :
        aria2RPC.capture['resolve'].includes(domain) ? true :
        aria2RPC.capture['fileExt'].includes(fileExt) ? true :
        aria2RPC.capture['fileSize'] > 0 && fileSize >= aria2RPC.capture['fileSize'] ? true : false;
}

function getDomainFromUrl(url) {
    var host = /^[^:]+:\/\/([^\/]+)\//.exec(url)[1];
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
    chrome.browserAction.setBadgeBackgroundColor({color: '#3cc'});
    aria2RPCCall({method: 'aria2.getGlobalStat'}, global => {
        chrome.browserAction.setBadgeText({text: global.numActive === '0' ? '' : global.numActive});
    }, error => {
        chrome.browserAction.setBadgeBackgroundColor({color: '#c33'});
        chrome.browserAction.setBadgeText({text: 'E'});
    }, true);
}
