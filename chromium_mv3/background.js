importScripts('lib/aria2.js', 'lib/tools.js', 'lib/core.js', 'res/common.js', 'res/expansion.js');

aria2StartUp();

chrome.runtime.onStartup.addListener(aria2StartUp);

chrome.runtime.onInstalled.addListener(({reason}) => {
    chrome.contextMenus.create({
        title: chrome.i18n.getMessage('contextmenu_dldthis'),
        id: 'download_this_item',
        contexts: ['link', 'image']
    });
});

chrome.contextMenus.onClicked.addListener(({menuItemId, linkUrl}, {id, url}) => {
    if (menuItemId === 'download_this_item') {
        aria2Download(linkUrl, url, getHostname(url));
    }
});

chrome.downloads.onCreated.addListener(async ({id, finalUrl, referrer}) => {
    var url = finalUrl;
    var referer = referrer === '' ? await getCurrentTabUrl() : referrer;
    var hostname = getHostname(referer);
    if (finalUrl.startsWith('blob') || finalUrl.startsWith('data')) {
        var priority = -1;
    }
    else {
        priority = getCaptureHostname(hostname);
    }
    aria2Monitor[id] = {url, referer, hostname, priority};
});

chrome.downloads.onDeterminingFilename.addListener(({id, filename, fileSize}) => {
    if (!aria2Store['capture_enabled']) {
        return;
    }
    var {url, referer, hostname, priority} = aria2Monitor[id];
    if (priority < 0) {
        return;
    }
    priority += getCaptureFileData(fileSize, getFileExtension(filename));
    if (priority > 0) {
        chrome.downloads.erase({id});
        aria2Monitor[id].priority = priority;
        aria2Download(url, referer, hostname, {out: filename});
    }
});

async function aria2StartUp() {
    var json = await chrome.storage.local.get(null);
    aria2Store = {...aria2Default, ...json};
    aria2Initial();
    aria2Manager();
}

function aria2Update(changes) {
    if ('jsonrpc_uri' in changes || 'jsonrpc_token' in changes) {
        aria2Initial();
    }
    if ('manager_newtab' in changes) {
        aria2Manager();
    }
}
