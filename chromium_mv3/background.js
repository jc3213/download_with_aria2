importScripts('libs/aria2.js', 'libs/core.js', 'libs/tools.js', 'crossbrowser.js');

chrome.downloads.onDeterminingFilename.addListener(async ({id, finalUrl, referrer, filename, fileSize}) => {
    if (!aria2Storage['capture_enabled') {
        return;
    }
    if (aria2History[finalUrl]) {
        delete aria2History[finalUrl];
        return;
    }
    chrome.downloads.erase({id});
    aria2Monitor[id] = {url: finalUrl, referrer, filename, fileSize};
    aria2History[finalUrl] = id;

});

chrome.downloads.onErased.addListener(async (id) => {
    if (!aria2Monitor[id]) {
        return;
    }
    var {url, referrer, filename, fileSize} = aria2Monitor[id];
    if (testUrlScheme(url)) {
        return aria2NativeDownload(url, referrer, filename);
    }
    var referer = referrer === '' ? await getCurrentTabUrl() : referrer;
    var hostname = getHostname(referer);
    var captured = aria2CaptureResult(hostname, getFileExtension(filename), fileSize);
    if (captured) {
        delete aria2History[url];
        delete aria2Monitor[id];
        return aria2Download(url, {out: filename}, referer, hostname);
    }
    aria2NativeDownload(url, referrer, filename);
});

chrome.storage.sync.get(null).then((json) => {
    aria2Storage = {...aria2Default, ...json};
    aria2ClientSetUp();
    aria2MatchPattern();
    aria2TaskManager();
    aria2ContextMenus();
});

var aria2Persistent = setInterval(chrome.runtime.getPlatformInfo, 25e3);
