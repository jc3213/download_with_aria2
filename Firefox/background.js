browser.runtime.onInstalled.addListener(({reason, previousVersion}) => {
    reason === 'update' && previousVersion < '3.9.4' && setTimeout(() => {
        store['capture_include'] = store['capture_resolve'];
        store['capture_exclude'] = store['capture_reject'];
        store['capture_resolve'] = store['capture_type'];
        store['capture_reject'] = ['xpi'];
        store['proxy_include'] = store['proxy_resolve'];
        delete store['capture_type'];
        delete store['proxy_resolve'];
        browser.storage.local.set(store);
    }, 500);
});

browser.contextMenus.create({
    title: browser.runtime.getManifest().name,
    id: 'downwitharia2firefox',
    contexts: ['link']
});

browser.contextMenus.onClicked.addListener(({linkUrl, pageUrl}, {cookieStoreId}) => {
    startDownload(linkUrl, pageUrl, getDomainFromUrl(pageUrl), cookieStoreId);
});

browser.storage.local.get(null, async json => {
    store = json['jsonrpc_uri'] ? json : await fetch('/options.json').then(response => response.json());
    store['capture_api'] = store['capture_api'] ?? '1';
    statusIndicator();
    !json['jsonrpc_uri'] && (store['capture_reject'] = ['xpi']) && browser.storage.local.set(store);
});

browser.storage.onChanged.addListener(changes => {
    Object.entries(changes).forEach(([key, {newValue}]) => store[key] = newValue);
    changes['jsonrpc_uri'] && statusIndicator();
});

browser.downloads.onCreated.addListener(async ({id, url, referrer, filename}) => {
    if (store['capture_api'] === '1' || store['capture_mode'] === '0' || url.startsWith('blob') || url.startsWith('data')) {
        return;
    }
    var {tabUrl, cookieStoreId} = await browser.tabs.query({active: true, currentWindow: true}).then(([{url, cookieStoreId}]) => ({tabUrl: url, cookieStoreId}));
    var referer = referrer ?? tabUrl ?? 'about:blank';
    var domain = getDomainFromUrl(referer);
    captureDownload(domain, getFileExtension(filename)) && browser.downloads.cancel(id).then(async () => {
        await browser.downloads.erase({id}) && startDownload(url, referer, domain, cookieStoreId, await getFirefoxExclusive(filename));
    }).catch(error => showNotification('Download is already complete'));
});

browser.webRequest.onHeadersReceived.addListener(async ({statusCode, tabId, url, originUrl, responseHeaders}) => {
    if (store['capture_api'] === '0' || store['capture_mode'] === 0 || statusCode !== 200) {
        return;
    }
    var match = [{}, 'content-disposition', 'content-type', 'content-length'];
    responseHeaders.forEach(({name, value}) => match.includes(name = name.toLowerCase()) && (match[0][name.slice(name.indexOf('-') + 1)] = value));
    var {disposition, type, length} = match[0];
    if (type.startsWith('application') || disposition && disposition.startsWith('attachment')) {
console.log('--------------------------\n' + originUrl)
        var out = getFileName(disposition);
        var domain = getDomainFromUrl(originUrl);
        if (captureDownload(domain, getFileExtension(out), length)) {
console.log(tabId);
            var {cookieStoreId} = await browser.tabs.get(tabId);
console.log(cookieStoreId);
            startDownload(url, originUrl, domain, cookieStoreId, {out});
            return {cancel: true};
        }
console.log('Failed to Capture', url, filename, responseHeaders);
    }
}, {urls: ["<all_urls>"], types: ["main_frame", "sub_frame"]}, ["blocking", "responseHeaders"]);

function statusIndicator() {
    aria2RPCCall({method: 'aria2.tellActive'}, result => {
        active = result.map(({gid}) => gid);
        self.jsonrpc && jsonrpc.readyState === 1 && jsonrpc.close();
        jsonrpc = new WebSocket(store['jsonrpc_uri'].replace('http', 'ws'));
        jsonrpc.onmessage = event => {
            var {method, params: [{gid}]} = JSON.parse(event.data);
            var index = active.indexOf(gid);
            method === 'aria2.onDownloadStart' ? index === -1 && active.push(gid) : method !=='aria2.onBtDownloadComplete' && index !== -1 && active.splice(index, 1);
            browser.browserAction.setBadgeText({text: active.length === 0 ? '' : active.length + ''});
        };
        browser.browserAction.setBadgeText({text: active.length === 0 ? '' : active.length + ''});
        browser.browserAction.setBadgeBackgroundColor({color: '#3cc'});
    }, error => {
        self.jsonrpc && jsonrpc.readyState === 1 && jsonrpc.close();
        browser.browserAction.setBadgeText({text: 'E'});
        browser.browserAction.setBadgeBackgroundColor({color: '#c33'});
    });
}

async function startDownload(url, referer, domain, storeId = 'firefox-default', options = {}) {
    var cookies = await browser.cookies.getAll({url, storeId});
    options['header'] = ['Cookie:', 'Referer: ' + referer, 'User-Agent: ' + store['user_agent']];
    cookies.forEach(({name, value}) => options['header'][0] += ' ' + name + '=' + value + ';');
    options['all-proxy'] = store['proxy_include'].includes(domain) ? store['proxy_server'] : '';
    aria2RPCCall({method: 'aria2.addUri', params: [[url], options]}, result => showNotification(url));
}

function captureDownload(domain, type, size) {
    return store['capture_exclude'].includes(domain) ? false :
        store['capture_reject'].includes(type) ? false :
        store['capture_mode'] === '2' ? true :
        store['capture_include'].includes(domain) ? true :
        store['capture_resolve'].includes(type) ? true :
        store['capture_size'] > 0 && size >= store['capture_size'] ? true : false;
}

function getDomainFromUrl(url) {
    if (url.startsWith('about') || url.startsWith('chrome')) {
        return url;
    }
    var hostname = new URL(url).hostname;
    if (hostname.startsWith('[')) {
        return hostname.slice(1, -1);
    }
    var pattern = hostname.split('.');
    if (pattern.length === 2 || pattern.length === 4 && !isNaN(pattern[3])) {
        return hostname;
    }
    var domain = ['com', 'net', 'org', 'edu', 'gov', 'co', 'ne', 'or', 'me'].includes(pattern[pattern.length - 2]) ? pattern.slice(-3) : pattern.slice(-2);
    return domain.join('.');
}

function getFileName(disposition) {
    var match = /filename\*=[^;]*''([^;]+)/.exec(disposition) ?? /^[^;]+;[^;]*filename=([^;]+);?/.exec(disposition);
    if (match) {
console.log(disposition, match);
        var filename = match.pop().replaceAll('"', '');
        if (!/[^\u0000-\u007f]/g.test(filename)) {
console.log(decodeURI(filename))
            return decodeURI(filename);
        }
console.log('Non-Standard Filename', filename);
    }
    return '';
}

function getFileExtension(filename) {
    return filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
}

async function getFirefoxExclusive(uri) {
    var {os} = await browser.runtime.getPlatformInfo();
    var index = os === 'win' ? uri.lastIndexOf('\\') : uri.lastIndexOf('/');
    var out = uri.slice(index + 1);
    var dir = store['folder_mode'] === '1' ? uri.slice(0, index + 1) : store['folder_mode'] === '2' ? store['folder_path'] : null;
    return dir ? {dir, out} : {out};
}

function showNotification(message = '') {
    browser.notifications.create({
        type: 'basic',
        title: store['jsonrpc_uri'],
        iconUrl: '/icons/icon48.png',
        message
    });
}
