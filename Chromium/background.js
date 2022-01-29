chrome.runtime.onInstalled.addListener(({reason, previousVersion}) => {
    reason === 'update' && previousVersion < '3.9.4' && setTimeout(() => {
        store['capture_include'] = store['capture_resolve'];
        store['capture_exclude'] = store['capture_reject'];
        store['capture_resolve'] = store['capture_type'];
        store['capture_reject'] = [];
        store['proxy_include'] = store['proxy_resolve'];
        delete store['capture_type'];
        delete store['proxy_resolve'];
        chrome.storage.local.set(store);
    }, 1000);
});

chrome.contextMenus.create({
    title: chrome.runtime.getManifest().name,
    id: 'downwitharia2',
    contexts: ['link']
});

chrome.contextMenus.onClicked.addListener(({linkUrl, pageUrl}) => {
    startDownload(linkUrl, pageUrl, getDomainFromUrl(pageUrl));
});

chrome.storage.local.get(null, async json => {
    store = json['jsonrpc_uri'] ? json : await fetch('/options.json').then(response => response.json());
    !json['jsonrpc_uri'] && chrome.storage.local.set(store);
});

chrome.storage.onChanged.addListener(changes => {
    Object.entries(changes).forEach(([key, {newValue}]) => store[key] = newValue);
});

chrome.downloads.onDeterminingFilename.addListener(({id, finalUrl, referrer, filename, fileSize}) => {
    if (store['capture_mode'] === '0' || finalUrl.startsWith('blob') || finalUrl.startsWith('data')) {
        return;
    }
    chrome.tabs.query({active: true, currentWindow: true}, ([{url}]) => {
        var referer = referrer ?? url ?? 'about:blank';
        var domain = getDomainFromUrl(referer);
        captureDownload(domain, getFileExtension(filename), fileSize) && chrome.downloads.erase({id}, () => startDownload(finalUrl, referer, domain, {out: filename}));
    });
});

function startDownload(url, referer, domain, options = {}) {
    chrome.cookies.getAll({url}, cookies => {
        options['header'] = ['Cookie:', 'Referer: ' + referer, 'User-Agent: ' + store['user_agent']];
        cookies.forEach(({name, value}) => options['header'][0] += ' ' + name + '=' + value + ';');
        options['all-proxy'] = store['proxy_include'].includes(domain) ? store['proxy_server'] : '';
        aria2RPCCall({method: 'aria2.addUri', params: [[url], options]}, result => showNotification(url))
    });
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
