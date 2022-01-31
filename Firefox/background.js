browser.contextMenus.create({
    title: browser.runtime.getManifest().name,
    id: 'downwitharia2firefox',
    contexts: ['link']
});

browser.contextMenus.onClicked.addListener(({linkUrl, pageUrl}, {cookieStoreId}) => {
    startDownload(linkUrl, pageUrl, getDomainFromUrl(pageUrl), cookieStoreId);
});

browser.storage.local.get(null, async json => {
    aria2Store = json['jsonrpc_uri'] ? json : await fetch('/options.json').then(response => response.json());
    aria2Store['capture_api'] = aria2Store['capture_api'] ?? '1';
    !json['jsonrpc_uri'] && chrome.storage.local.set(aria2Store);
    statusIndicator();
    if (!aria2Store['proxy_include']) {
        aria2Store['proxy_include'] = [];
        aria2Store['capture_resolve'] = aria2Store['capture_resolve'] ?? aria2Store['type'] ?? [];
        delete aria2Store['proxy_resolve'];
        delete aria2Store['type'];
        chrome.storage.local.set(aria2Store);
    }
});

browser.storage.onChanged.addListener(changes => {
    Object.entries(changes).forEach(([key, {newValue}]) => aria2Store[key] = newValue);
    if (changes['jsonrpc_uri'] || changes['secret_token']) {
        self.jsonrpc && jsonrpc.readyState === 1 && jsonrpc.close();
        statusIndicator();
    }
});

browser.downloads.onCreated.addListener(async ({id, url, referrer, filename}) => {
    if (aria2Store['capture_api'] === '1' || aria2Store['capture_mode'] === '0' || url.startsWith('blob') || url.startsWith('data')) {
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
    if (aria2Store['capture_api'] === '0' || aria2Store['capture_mode'] === 0 || statusCode !== 200) {
        return;
    }
    var match = [{}, 'content-disposition', 'content-type', 'content-length'];
    responseHeaders.forEach(({name, value}) => match.includes(name = name.toLowerCase()) && (match[0][name.slice(name.indexOf('-') + 1)] = value));
    var {disposition, type, length} = match[0];
    if (type.startsWith('application') || disposition && disposition.startsWith('attachment')) {
console.log('--------------------------\n' + url + '\n' + originUrl + '\n');
        var out = getFileName(disposition);
        var domain = getDomainFromUrl(originUrl);
        if (captureDownload(domain, getFileExtension(out), length)) {
            var {cookieStoreId} = await browser.tabs.get(tabId);
            startDownload(url, originUrl, domain, cookieStoreId, {out});
            return {cancel: true};
        }
    }
}, {urls: ["<all_urls>"], types: ["main_frame", "sub_frame"]}, ["blocking", "responseHeaders"]);

async function statusIndicator() {
    jsonrpc = await aria2RPCStatus(text => {
        browser.browserAction.setBadgeText({text: text === '0' ? '' : text});
        browser.browserAction.setBadgeBackgroundColor({color: text ? '#3cc' : '#c33'});
    });
}

async function startDownload(url, referer, domain, storeId = 'firefox-default', options = {}) {
    var cookies = await browser.cookies.getAll({url, storeId});
    options['header'] = ['Cookie:', 'Referer: ' + referer, 'User-Agent: ' + aria2Store['user_agent']];
    cookies.forEach(({name, value}) => options['header'][0] += ' ' + name + '=' + value + ';');
    options['all-proxy'] = aria2Store['proxy_include'].includes(domain) ? aria2Store['proxy_server'] : '';
    aria2RPCCall({method: 'aria2.addUri', params: [[url], options]}, result => showNotification(url));
}

function captureDownload(domain, type, size) {
    return aria2Store['capture_exclude'].includes(domain) ? false :
        aria2Store['capture_reject'].includes(type) ? false :
        aria2Store['capture_mode'] === '2' ? true :
        aria2Store['capture_include'].includes(domain) ? true :
        aria2Store['capture_resolve'].includes(type) ? true :
        aria2Store['capture_size'] > 0 && size >= aria2Store['capture_size'] ? true : false;
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
    var match = /([^\?]+)\?.{0,3}$/i.exec(disposition) ?? /filename\*=[^;]*''([^;]+)/.exec(disposition) ?? /^[^;]+;[^;]*filename=([^;]+);?/.exec(disposition);
    if (match) {
        var result = match.pop();
console.log(disposition + '\n' + result);
        try { result = atob(result) } catch(error) {}
        var filename = decodeFilename(result.replaceAll('"', ''));
console.log(filename);
    }
    return filename;
}

function getFileExtension(filename) {
    return filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
}

async function getFirefoxExclusive(uri) {
    var {os} = await browser.runtime.getPlatformInfo();
    var index = os === 'win' ? uri.lastIndexOf('\\') : uri.lastIndexOf('/');
    var out = uri.slice(index + 1);
    var dir = aria2Store['folder_mode'] === '1' ? uri.slice(0, index + 1) : aria2Store['folder_mode'] === '2' ? aria2Store['folder_path'] : null;
    return dir ? {dir, out} : {out};
}

async function showNotification(message = '') {
    var id = await browser.notifications.create({type: 'basic', iconUrl: '/icons/icon48.png', title: aria2Store['jsonrpc_uri'], message});
    setTimeout(() => browser.notifications.clear(id), 5000);
}
