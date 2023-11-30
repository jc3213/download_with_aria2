importScripts('libs/aria2.js', 'libs/tools.js', 'libs/core.js', 'expansion.js', 'crossbrowser.js');

chrome.runtime.onStartup.addListener(aria2Activate);

chrome.runtime.onInstalled.addListener(async ({reason}) => {
    await aria2Activate();
    aria2ContextMenus();
});

chrome.contextMenus.onClicked.addListener(async ({menuItemId, linkUrl, srcUrl}, {id, url}) => {
    if (menuItemId === 'aria2c_this_url') {
        await aria2Initial();
        aria2Download(linkUrl, url, getHostname(url));
    }
    else if (menuItemId === 'aria2c_this_image') {
        await aria2Initial();
        aria2Download(srcUrl, url, getHostname(url));
    }
    else if (menuItemId === 'aria2c_all_images') {
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

async function aria2Activate() {
    var json = await chrome.storage.sync.get(null);
    aria2Store = {...aria2Default, ...json};
    aria2ClientSetUp();
    aria2TaskManager();
}

async function aria2Initial() {
    if (!aria2RPC) {
        aria2Store = await chrome.storage.sync.get(null);
        aria2ClientSetUp();
    }
}
