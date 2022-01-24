importScripts('/libs/core.js');

chrome.runtime.onInstalled.addListener(({reason, previousVersion}) => {
    chrome.contextMenus.create({
        title: chrome.runtime.getManifest().name,
        id: 'downwitharia2',
        contexts: ['link']
    });
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
            'capture_size': aria2RPC.capture.fileSize,
            'capture_resolve': aria2RPC.capture.resolve,
            'capture_reject': aria2RPC.capture.reject,
            'folder_mode': aria2RPC.folder.mode ?? '0',
            'folder_path': aria2RPC.folder.uri ?? ''
        };
        Storage = patch;
        chrome.storage.local.clear();
        chrome.storage.local.set(Storage);
    }, 300);
});

chrome.contextMenus.onClicked.addListener(({linkUrl, pageUrl}) => {
    startDownload({url: linkUrl, referer: pageUrl, domain: getDomainFromUrl(pageUrl)});
});

chrome.downloads.onDeterminingFilename.addListener(async ({id, finalUrl, referrer, filename, fileSize}) => {
    if (Storage['capture_mode'] === '0' || finalUrl.startsWith('blob') || finalUrl.startsWith('data')) {
        return;
    }

    var tabs = await chrome.tabs.query({active: true, currentWindow: true});
    var url = finalUrl;
    var referer = referrer && referrer !== 'about:blank' ? referrer : tabs[0].url;
    var domain = getDomainFromUrl(referer);

    captureDownload(domain, getFileExtension(filename), fileSize) && 
        chrome.downloads.cancel(id, () => {
            chrome.downloads.erase({id}, () => {
                startDownload({url, referer, domain, filename});
            });
        });
});

async function startDownload({url, referer, domain, filename}, options = {}) {
    var cookies = await chrome.cookies.getAll({url});
    options['header'] = ['Cookie:', 'Referer: ' + referer, 'User-Agent: ' + Storage['user_agent']];
    cookies.forEach(({name, value}) => options['header'][0] += ' ' + name + '=' + value + ';');
    options['out'] = filename;
    options['all-proxy'] = Storage['proxy_resolve'].includes(domain) ? Storage['proxy_server'] : '';
    aria2RPCCall({method: 'aria2.addUri', params: [[url], options]}, result => showNotification(url));
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
