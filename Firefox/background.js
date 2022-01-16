browser.runtime.onInstalled.addListener(({reason, previousVersion}) => {
    if (reason === 'update' && previousVersion < '3.7.5') {
        var patch = {
            'jsonrpc_uri': aria2RPC.jsonrpc.uri,
            'secret_token': aria2RPC.jsonrpc.token,
            'refresh_interval': aria2RPC.jsonrpc.refresh,
            'user_agent': aria2RPC.useragent,
            'proxy_server': aria2RPC.proxy.uri,
            'proxy_resolve': aria2RPC.proxy.resolve,
            'capture_mode': aria2RPC.capture.mode,
            'capture_type': aria2RPC.capture.fileExt,
            //'capture_size': aria2RPC.capture.fileSize,
            'capture_resolve': aria2RPC.capture.resolve,
            'capture_reject': aria2RPC.capture.reject,
            'folder_mode': aria2RPC.folder.mode,
            'folder_path': aria2RPC.folder.uri
        };
        aria2RPC = patch;
        chrome.storage.local.clear();
        chrome.storage.local.set(aria2RPC);
    }
});

browser.runtime.getPlatformInfo(({os}) => {
    aria2Log.win === os;
});

browser.contextMenus.create({
    title: browser.i18n.getMessage('extension_name'),
    id: 'downwitharia2firefox',
    contexts: ['link']
});

browser.contextMenus.onClicked.addListener(({linkUrl, pageUrl}, {cookieStoreId}) => {
    startDownload({url: linkUrl, referer: pageUrl, storeId: cookieStoreId, domain: getDomainFromUrl(pageUrl)});
});

browser.downloads.onCreated.addListener(async item({id, url, referrer, filename}) => {
    if (aria2RPC['capture_mode'] === '0' || url.startsWith('blob') || url.startsWith('data')) {
        return;
    }

    var tabs = await browser.tabs.query({active: true, currentWindow: true});
    var referer = referrer && referrer !== 'about:blank' ? referrer : tabs[0].url;
    var domain = getDomainFromUrl(referer);
    var {filename, folder} = getFileNameFromUri(filename);
    folder = aria2RPC['folder_mode'] === '1' ? folder : aria2RPC.folder['mode'] === '2' ? aria2RPC['folder_path'] : null;
    var storeId = tabs[0].cookieStoreId;

    captureDownload(domain, getFileExtension(filename)) &&
        browser.downloads.cancel(id).then(() => {
            browser.downloads.erase({id}).then(() => {
                startDownload({url, referer, domain, filename, folder, storeId});
            });
        }).catch(error => showNotification('Download is already complete'));
});

async function startDownload({url, referer, domain, filename, folder, storeId}, options = {}) {
    var cookies = await browser.cookies.getAll({url, storeId});
    options['header'] = ['Cookie:', 'Referer: ' + referer, 'User-Agent: ' + aria2RPC['user_agent']];
    cookies.forEach(({name, value}) => options['header'][0] += ' ' + name + '=' + value + ';');
    options['out'] = filename;
    options['all-proxy'] = aria2RPC['proxy_resolve'].includes(domain) ? aria2RPC['proxy_server'] : '';
    folder && (options['dir'] = folder);
    aria2RPCCall({method: 'aria2.addUri', params: [[url], options]}, result => showNotification(url));
}

function captureDownload(domain, type) {
    return aria2RPC['capture_reject'].includes(domain) ? false :
        aria2RPC['capture_mode'] === '2' ? true :
        aria2RPC['capture_resolve'].includes(domain) ? true :
        aria2RPC['capture_type'].includes(type) ? true : false;
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

function getFileNameFromUri(uri) {
    var index = aria2Log.win === 'win' ? uri.lastIndexOf('\\') : uri.lastIndexOf('/');
    return {folder: uri.slice(0, index + 1), filename: uri.slice(index + 1)};
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
