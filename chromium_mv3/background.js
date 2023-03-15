importScripts('lib/aria2.js', 'lib/tools.js', 'lib/core.js', 'res/common.js', 'res/expansion.js');

self.addEventListener('activate', aria2StartUp);

chrome.runtime.onStartup.addListener(aria2StartUp);

chrome.runtime.onInstalled.addListener(async details => {
    chrome.contextMenus.create({
        title: chrome.i18n.getMessage('contextmenu_dldthis'),
        id: 'download_this_item',
        contexts: ['link', 'image']
    });
    chrome.contextMenus.create({
        title: chrome.i18n.getMessage('contextmenu_images'),
        id: 'download_all_images',
        contexts: ['page']
    });
});

chrome.contextMenus.onClicked.addListener(async ({menuItemId, linkUrl}, {id, url}) => {
    if (menuItemId === 'download_this_item') {
        aria2Download(linkUrl, url, getHostname(url));
    }
    else if (menuItemId === 'download_all_images') {
        chrome.tabs.sendMessage(id, 'sniffer');
    }
});

chrome.downloads.onCreated.addListener(async ({id, finalUrl, referrer}) => {
    var url = finalUrl;
    var referer = referrer === '' ? await getCurrentTabUrl() : referrer;
    var hostname = getHostname(referer);
    var skipped = url.startsWith('blob') || url.startsWith('data');
    aria2Monitor[id] = {url, referer, hostname, skipped};
});

chrome.downloads.onDeterminingFilename.addListener(async ({id, filename, fileSize}) => {
    await aria2Initial();
    var {url, referer, hostname, skipped} = aria2Monitor[id];
    if (!aria2Store['capture_enabled'] || skipped) {
        return;
    }
    var captured = getCaptureGeneral(hostname, getFileExtension(filename), fileSize);
    if (captured) {
        chrome.downloads.erase({id});
        aria2Download(url, referer, hostname, {out: filename});
    }
    aria2Monitor[id].captured = captured;
});

async function aria2StartUp() {
    var json = await chrome.storage.local.get(null);
    aria2Store = {...aria2Default, ...json};
    aria2Client();
    aria2Manager();
}

async function aria2Initial() {
    if (!aria2RPC) {
        aria2Store = await chrome.storage.local.get(null);
        aria2Client();
    }
}

function aria2Update(changes) {
    if ('jsonrpc_uri' in changes || 'jsonrpc_token' in changes) {
        aria2Client();
    }
    if ('manager_newtab' in changes) {
        aria2Manager();
    }
}
