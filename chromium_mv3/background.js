importScripts('libs/aria2.js', 'libs/tools.js', 'libs/core.js', 'crossbrowser.js', 'expansion.js');

chrome.runtime.onStartup.addListener(aria2StartUp);

chrome.runtime.onInstalled.addListener(async details => {
    chrome.contextMenus.create({
        title: chrome.i18n.getMessage('contextmenu_thisurl'),
        id: 'download_this_url',
        contexts: ['link']
    });
    chrome.contextMenus.create({
        title: chrome.i18n.getMessage('contextmenu_thisimage'),
        id: 'download_this_image',
        contexts: ['image']
    });
    chrome.contextMenus.create({
        title: chrome.i18n.getMessage('contextmenu_allimages'),
        id: 'download_all_images',
        contexts: ['page']
    });
    aria2StartUp();
});

chrome.contextMenus.onClicked.addListener(async ({menuItemId, linkUrl, srcUrl}, {id, url}) => {
    if (menuItemId === 'download_this_url') {
        await aria2Initial();
        aria2Download(linkUrl, url, getHostname(url));
    }
    else if (menuItemId === 'download_this_image') {
        await aria2Initial();
        aria2Download(srcUrl, url, getHostname(url));
    }
    else if (menuItemId === 'download_all_images') {
        chrome.tabs.sendMessage(id, menuItemId);
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
    if ('download_headers' in aria2Store) {
        aria2Store['headers_enabled'] = aria2Store['download_headers'];
        delete aria2Store['download_headers'];
        chrome.storage.local.set(aria2Store);
    }
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
