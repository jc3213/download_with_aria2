browser.runtime.onInstalled.addListener(({reason, previousVersion}) => {
    reason === 'update' && previousVersion < '3.7.5' && setTimeout(() => {
        var patch = {
            'jsonrpc_uri': aria2RPC.jsonrpc.uri,
            'secret_token': aria2RPC.jsonrpc.token,
            'refresh_interval': aria2RPC.jsonrpc.refresh,
            'user_agent': aria2RPC.useragent,
            'proxy_server': aria2RPC.proxy.uri,
            'proxy_resolve': aria2RPC.proxy.resolve,
            'capture_mode': aria2RPC.capture.mode,
            'capture_type': aria2RPC.capture.fileExt,
            'capture_size': aria2RPC.capture.fileSize ?? 0,
            'capture_resolve': aria2RPC.capture.resolve,
            'capture_reject': aria2RPC.capture.reject,
            'folder_mode': aria2RPC.folder.mode,
            'folder_path': aria2RPC.folder.uri
        };
        Storage = patch;
        chrome.storage.local.clear();
        chrome.storage.local.set(Storage);
    }, 300);
    reason === 'update' && previousVersion > '3.7.5' && previousVersion < '3.8.0' && setTimeout(() => {
        Storage['capture_api'] = '1';
        chrome.storage.local.set(Storage);
    }, 500);
});

browser.contextMenus.create({
    title: browser.i18n.getMessage('extension_name'),
    id: 'downwitharia2firefox',
    contexts: ['link']
});

browser.contextMenus.onClicked.addListener(({linkUrl, pageUrl}, {cookieStoreId}) => {
    startDownload({url: linkUrl, referer: pageUrl, storeId: cookieStoreId, domain: getDomainFromUrl(pageUrl)});
});

browser.downloads.onCreated.addListener(async ({id, url, referrer, filename}) => {
    if (Storage['capture_api'] === '1' || Storage['capture_mode'] === '0' || url.startsWith('blob') || url.startsWith('data')) {
        return
    }
    var tabs = await browser.tabs.query({active: true, currentWindow: true});
    var referer = referrer && referrer !== 'about:blank' ? referrer : tabs[0].url;
    var domain = getDomainFromUrl(referer);
    var storeId = tabs[0].cookieStoreId;

    captureDownload(domain, getFileExtension(filename)) &&
        browser.downloads.cancel(id).then(() => {
            browser.downloads.erase({id}).then(() => {
                getFirefoxExclusive(filename).then(options => {
                    startDownload({url, referer, domain, storeId}, options);
                });
            });
        }).catch(error => showNotification('Download is already complete'));
});

browser.webRequest.onHeadersReceived.addListener(async ({statusCode, tabId, url, originUrl, responseHeaders}) => {
    if (Storage['capture_api'] === '0' || Storage['capture_mode'] === 0 || statusCode !== 200) {
        return;
    }
    var attachment;
    var application;
    var fileSize;
    responseHeaders.forEach(({name, value}) => {
        name.toLowerCase() === 'content-disposition' && (attachment = value);
        name.toLowerCase() === 'content-type' && (application = value);
        name.toLowerCase() === 'content-length' && (fileSize = value);
    });
    if (application.startsWith('application') || attachment.startsWith('attachment')) {
        var referer = originUrl;
        var filename = attachment ? attachment.slice(attachment.lastIndexOf('\'') + 1) : url.slice(url.lastIndexOf('/') + 1, url.includes('?') ? url.lastIndexOf('?') : url.length);
        var domain = getDomainFromUrl(originUrl);
        var storeId = await browser.tabs.get(tabId).then(({cookieStoreId}) => cookieStoreId);
        if (captureDownload(domain, getFileExtension(filename), fileSize ?? -1)) {
            startDownload({url, referer, domain, filename, storeId});
            return {cancel: true};
        }
    }
}, {urls: ["<all_urls>"], types: ["main_frame", "sub_frame"]}, ["blocking", "responseHeaders"]);

async function startDownload({url, referer, domain, filename, storeId}, options = {}) {
    var cookies = await browser.cookies.getAll({url, storeId});
    options['header'] = ['Cookie:', 'Referer: ' + referer, 'User-Agent: ' + Storage['user_agent']];
    cookies.forEach(({name, value}) => options['header'][0] += ' ' + name + '=' + value + ';');
    filename && (options['out'] = filename);
    options['all-proxy'] = Storage['proxy_resolve'].includes(domain) ? Storage['proxy_server'] : '';
    aria2RPCCall({method: 'aria2.addUri', params: [[url], options]}, result => showNotification(url));
}

async function getFirefoxExclusive(uri) {
    var platform = await browser.runtime.getPlatformInfo();
    var index = platform.os === 'win' ? uri.lastIndexOf('\\') : uri.lastIndexOf('/');
    var out = uri.slice(index + 1);
    var dir = Storage['folder_mode'] === '1' ? uri.slice(0, index + 1) : Storage['folder_mode'] === '2' ? Storage['folder_path'] : null;
    if (dir) {
        return {dir, out};
    }
    return {out};
}

function captureDownload(domain, type, size) {
    return Storage['capture_reject'].includes(domain) ? false :
        Storage['capture_mode'] === '2' ? true :
        Storage['capture_resolve'].includes(domain) ? true :
        Storage['capture_type'].includes(type) ? true :
        Storage['capture_size'] > 0 && size >= Storage['capture_size'] ? true : false;
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
    aria2RPCCall({method: 'aria2.getGlobalStat'}, ({numActive}) => {
        browser.browserAction.setBadgeBackgroundColor({color: '#3cc'});
        browser.browserAction.setBadgeText({text: numActive === '0' ? '' : numActive});
    }, error => {
        browser.browserAction.setBadgeBackgroundColor({color: '#c33'});
        browser.browserAction.setBadgeText({text: 'E'});
    }, true);
}
