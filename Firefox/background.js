browser.runtime.onInstalled.addListener(({reason, previousVersion}) => {
    reason === 'update' && previousVersion < '3.7.5' && setTimeout(() => {
        var patch = {
            'jsonrpc_uri': store.jsonrpc.uri,
            'secret_token': store.jsonrpc.token,
            'refresh_interval': store.jsonrpc.refresh,
            'user_agent': store.useragent,
            'proxy_server': store.proxy.uri,
            'proxy_resolve': store.proxy.resolve,
            'capture_mode': store.capture.mode,
            'capture_type': store.capture.fileExt,
            'capture_size': store.capture.fileSize ?? 0,
            'capture_resolve': store.capture.resolve,
            'capture_reject': store.capture.reject,
            'folder_mode': store.folder.mode,
            'folder_path': store.folder.uri
        };
        store = patch;
        chrome.storage.local.clear();
        chrome.storage.local.set(store);
    }, 300);
});

browser.contextMenus.create({
    title: browser.i18n.getMessage('extension_name'),
    id: 'downwitharia2firefox',
    contexts: ['link']
});

browser.contextMenus.onClicked.addListener(({linkUrl, pageUrl}, {cookieStoreId}) => {
    startDownload({url: linkUrl, referer: pageUrl, storeId: cookieStoreId, domain: getDomainFromUrl(pageUrl)});
});

browser.storage.local.get(null, async result => {
    store = 'jsonrpc_uri' in result ? result : await fetch('/options.json').then(response => response.json());
    aria2RPCClient();
    if (result['jsonrpc_uri'] === undefined) {
        store['capture_api'] = store['capture_api'] ?? '1';
        browser.storage.local.set(store);
    }
});

browser.storage.onChanged.addListener(changes => {
    Object.entries(changes).forEach(([key, {newValue}]) => store[key] = newValue);
    clearInterval(keepAlive) ?? aria2RPCClient();
});

browser.runtime.onMessage.addListener(({method, params, message}) => {
    aria2Message({method, params}, result => showNotification(message));
});

browser.downloads.onCreated.addListener(async ({id, url, referrer, filename}) => {
    if (store['capture_api'] === '1' || store['capture_mode'] === '0' || url.startsWith('blob') || url.startsWith('data')) {
        return;
    }

    var tabs = await browser.tabs.query({active: true, currentWindow: true});
    var referer = referrer && referrer !== 'about:blank' ? referrer : tabs[0].url;
    var domain = getDomainFromUrl(referer);
    var storeId = tabs[0].cookieStoreId;

    captureDownload(domain, getFileExtension(filename)) && browser.downloads.cancel(id).then(async () => {
        await browser.downloads.erase({id});
        startDownload({url, referer, domain, storeId}, await getFirefoxExclusive(filename));
    }).catch(error => showNotification('Download is already complete'));
});

browser.webRequest.onHeadersReceived.addListener(async ({statusCode, tabId, url, originUrl, responseHeaders}) => {
    if (store['capture_api'] === '0' || store['capture_mode'] === 0 || statusCode !== 200) {
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
        var filename = attachment ? attachment.slice(attachment.lastIndexOf('\'') + 1) : decodeURI(url.slice(url.lastIndexOf('/') + 1, url.includes('?') ? url.lastIndexOf('?') : url.length));
        var domain = getDomainFromUrl(originUrl);
        var storeId = await browser.tabs.get(tabId).then(({cookieStoreId}) => cookieStoreId);
        if (captureDownload(domain, getFileExtension(filename), fileSize ?? -1)) {
            startDownload({url, referer, domain, filename, storeId});
            return {cancel: true};
        }
    }
}, {urls: ["<all_urls>"], types: ["main_frame", "sub_frame"]}, ["blocking", "responseHeaders"]);

function aria2Message({method, params = []}, resolve, reject, alive) {
    var message = JSON.stringify({jsonrpc: '2.0', id: '', method, params: [store['secret_token'], ...params]});
    var jsonrpc = new WebSocket(store['jsonrpc_uri'].replace('http', 'ws'));
    jsonrpc.onopen = event => jsonrpc.send(message);
    jsonrpc.onmessage = event => {
        var {result, error} = JSON.parse(event.data);
        result && typeof resolve === 'function' && resolve(result);
        error && typeof reject === 'function' && reject(error);
    };
    alive && (keepAlive = setInterval(() => jsonrpc.send(message, resolve, reject), store['refresh_interval']));
}

async function startDownload({url, referer, domain, filename, storeId}, options = {}) {
    var cookies = await browser.cookies.getAll({url, storeId});
    options['header'] = ['Cookie:', 'Referer: ' + referer, 'User-Agent: ' + store['user_agent']];
    cookies.forEach(({name, value}) => options['header'][0] += ' ' + name + '=' + value + ';');
    filename && (options['out'] = filename);
    options['all-proxy'] = store['proxy_resolve'].includes(domain) ? store['proxy_server'] : '';
    aria2Message({method: 'aria2.addUri', params: [[url], options]}, result => showNotification(url));
}

async function getFirefoxExclusive(uri) {
    var platform = await browser.runtime.getPlatformInfo();
    var index = platform.os === 'win' ? uri.lastIndexOf('\\') : uri.lastIndexOf('/');
    var out = uri.slice(index + 1);
    var dir = store['folder_mode'] === '1' ? uri.slice(0, index + 1) : store['folder_mode'] === '2' ? store['folder_path'] : null;
    if (dir) {
        return {dir, out};
    }
    return {out};
}

function captureDownload(domain, type, size) {
    return store['capture_reject'].includes(domain) ? false :
        store['capture_mode'] === '2' ? true :
        store['capture_resolve'].includes(domain) ? true :
        store['capture_type'].includes(type) ? true :
        store['capture_size'] > 0 && size >= store['capture_size'] ? true : false;
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
    aria2Message({method: 'aria2.getGlobalStat'}, ({numActive}) => {
        browser.browserAction.setBadgeBackgroundColor({color: '#3cc'});
        browser.browserAction.setBadgeText({text: numActive === '0' ? '' : numActive});
    }, error => {
        browser.browserAction.setBadgeBackgroundColor({color: '#c33'});
        browser.browserAction.setBadgeText({text: 'E'});
    }, true);
}

function showNotification(message = '') {
    browser.notifications.create({
        type: 'basic',
        title: store['jsonrpc_uri'],
        iconUrl: '/icons/icon48.png',
        message
    });
}
