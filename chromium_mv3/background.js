importScripts('libs/aria2.js', 'libs/tools.js', 'libs/core.js', 'common.js', 'expansion.js');

aria2StartUp();

chrome.runtime.onStartup.addListener(aria2StartUp);

chrome.runtime.onInstalled.addListener(({reason}) => {
    chrome.contextMenus.create({
        title: chrome.runtime.getManifest().name,
        id: 'downwitharia2',
        contexts: ['link']
    });
});

chrome.contextMenus.onClicked.addListener(({menuItemId, linkUrl}, {id, url}) => {
    if (menuItemId === 'downwitharia2') {
        aria2Download(linkUrl, url, getHostname(url));
    }
});

chrome.storage.onChanged.addListener(changes => {
    Object.keys(changes).forEach(key => {
        var {newValue} = changes[key];
        aria2Store[key] = newValue;
    });
    if ('jsonrpc_uri' in changes || 'jsonrpc_token' in changes) {
        aria2Update();
    }
    if ('manager_newtab' in changes) {
        aria2Manager();
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
    aria2Update();
    aria2Manager();
}
