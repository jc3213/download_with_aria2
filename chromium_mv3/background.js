importScripts('libs/aria2.js', 'libs/core.js', 'libs/tools.js', 'crossbrowser.js');

chrome.downloads.onDeterminingFilename.addListener(async ({id, finalUrl, referrer, filename, fileSize}) => {
    if (!aria2Storage['capture_enabled') {
        return;
    }
    if (aria2Monitor[finalUrl]) {
        delete aria2Monitor[finalUrl];
        return;
    }
    chrome.downloads.erase({id});
    aria2Monitor[finalUrl] = id;
    if (testUrlScheme(finalUrl)) {
        return aria2NativeDownload(finalUrl, referrer, filename);
    }
    var referer = referrer === '' ? await getCurrentTabUrl() : referrer;
    var hostname = getHostname(referer);
    var captured = aria2CaptureResult(hostname, getFileExtension(filename), fileSize);
    if (captured) {
        delete aria2Monitor[finalUrl];
        return aria2Download(finalUrl, {out: filename}, referer, hostname);
    }
    aria2NativeDownload(finalUrl, referrer, filename);
});

chrome.storage.sync.get(null).then((json) => {
    aria2Storage = {...aria2Default, ...json};
    aria2ClientSetUp();
    aria2MatchPattern();
    aria2TaskManager();
    aria2ContextMenus();
});

var aria2Persistent = setInterval(chrome.runtime.getPlatformInfo, 25e3);
