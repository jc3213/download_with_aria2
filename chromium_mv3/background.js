importScripts('libs/aria2.js', 'libs/tools.js', 'libs/core.js', 'common.js', 'indicator.js');

aria2StartUp();

chrome.runtime.onStartup.addListener(() => {
    aria2StartUp();
});

chrome.runtime.onInstalled.addListener(details => {
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
    if ('jsonrpc_uri' in changes || 'secret_token' in changes) {
        aria2Update();
    }
});

chrome.downloads.onCreated.addListener(async ({id, finalUrl, referrer}) => {
    if (!self.aria2Store) {
        aria2Store = await chrome.storage.local.get(null);
    }
    var url = finalUrl;
    var referer = referrer === '' ? await getCurrentTabUrl() : referrer;
    var hostname = getHostname(referer);
    if (!aria2Store['capture_enabled'] || finalUrl.startsWith('blob') || finalUrl.startsWith('data')) {
        var priority = -1;
    }
    else {
        priority = getCaptureHostname(hostname);
    }
    aria2Monitor[id] = {url, referer, hostname, priority};
});

chrome.downloads.onDeterminingFilename.addListener(async ({id, filename, fileSize}) => {
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
    aria2Store = 'jsonrpc_uri' in json ? json : await getDefaultOptions();
    aria2Update();
}
