var store;
var jsonrpc;
var queue;

chrome.runtime.onInstalled.addListener(({reason, previousVersion}) => {
    chrome.contextMenus.create({
        title: chrome.runtime.getManifest().name,
        id: 'downwitharia2',
        contexts: ['link']
    });
});

chrome.storage.local.get(null, async result => {
    store = 'jsonrpc_uri' in result ? result : await fetch('/options.json').then(response => response.json());
    aria2WebSocket();
    !('jsonrpc_uri' in result) && chrome.storage.local.set(store);
});

chrome.storage.onChanged.addListener(changes => {
    Object.entries(changes).forEach(([key, {newValue}]) => store[key] = newValue);
    'jsonrpc_uri' in changes && jsonrpc.close() || aria2WebSocket();
});

chrome.contextMenus.onClicked.addListener(({linkUrl, pageUrl}) => {
    startDownload({url: linkUrl, referer: pageUrl, domain: getDomainFromUrl(pageUrl)});
});

chrome.downloads.onDeterminingFilename.addListener(async ({id, finalUrl, referrer, filename, fileSize}) => {
    if (store['capture_mode'] === '0' || finalUrl.startsWith('blob') || finalUrl.startsWith('data')) {
        return;
    }
    var url = finalUrl;
    var referer = referrer && referrer !== 'about:blank' ? referrer : await chrome.tabs.query({active: true, currentWindow: true}).then(([{url}]) => url);
    var domain = getDomainFromUrl(referer);
    captureDownload(domain, getFileExtension(filename), fileSize) && await chrome.downloads.erase({id}) && startDownload({url, referer, domain, filename});
});

chrome.runtime.onMessage.addListener(({method, params, message}) => {
    aria2Message(method, params, message);
});

function aria2WebSocket() {
    jsonrpc = new WebSocket(store['jsonrpc_uri'].replace('http', 'ws'));
    jsonrpc.onopen = event => jsonrpc.send(JSON.stringify({jsonrpc: '2.0', id: '', method: 'aria2.tellActive', params: [store['secret_token']]}));
    jsonrpc.onmessage = event => {
        var {result} = JSON.parse(event.data);
        result && (() => (queue = result.map(({gid}) => gid)) && chrome.action.setBadgeText({text: queue.length === 0 ? '' : queue.length + ''}))();
    };
    jsonrpc.addEventListener('message', event => {
        var {method, params} = JSON.parse(event.data);
        method && (() => {
            var gid = params[0].gid;
            var index = queue.indexOf(gid);
            method === 'aria2.onDownloadStart' ? index === -1 && queue.push(gid) : method !=='aria2.onBtDownloadComplete' && index !== -1 && queue.splice(index, 1);
            chrome.action.setBadgeText({text: queue.length === 0 ? '' : queue.length + ''});
        })();
    });
}

function aria2Message(method, params, message) {
    jsonrpc.send(JSON.stringify({jsonrpc: '2.0', id: '', method, params: [store['secret_token'], ...params]}));
    jsonrpc.onmessage = event => JSON.parse(event.data).result && (jsonrpc.onmessage = showNotification(message) ?? null);
}

async function startDownload({url, referer, domain, filename}, options = {}) {
    var cookies = await chrome.cookies.getAll({url});
    options['header'] = ['Cookie:', 'Referer: ' + referer, 'User-Agent: ' + store['user_agent']];
    cookies.forEach(({name, value}) => options['header'][0] += ' ' + name + '=' + value + ';');
    options['out'] = filename;
    options['all-proxy'] = store['proxy_resolve'].includes(domain) ? store['proxy_server'] : '';
    aria2Message('aria2.addUri', [[url], options], url);
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

function showNotification(message = '') {
    chrome.notifications.create({
        type: 'basic',
        title: store['jsonrpc_uri'],
        iconUrl: '/icons/icon48.png',
        message
    });
}
