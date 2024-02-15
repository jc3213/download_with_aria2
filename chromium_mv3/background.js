importScripts('libs/aria2.js', 'libs/core.js', 'crossbrowser.js');

chrome.downloads.onDeterminingFilename.addListener(async ({id, finalUrl, referrer, filename, fileSize}) => {
    if (!aria2Storage['capture_enabled'] || finalUrl.startsWith('data') || finalUrl.startsWith('blob')) {
        return;
    }
    var hostname = referrer === '' ? getHostname(finalUrl) : getHostname(referrer);
    var captured = aria2CaptureResult(hostname, getFileExtension(filename), fileSize);
    if (captured) {
        chrome.downloads.erase({id});
        aria2Download(finalUrl, {out: filename}, referrer, hostname);
    }
});

chrome.storage.sync.get(null).then((json) => {
    aria2Storage = {...aria2Default, ...json};
    aria2ClientSetUp();
    aria2MatchPattern();
    aria2TaskManager();
    aria2ContextMenus();
});

var aria2Persistent = setInterval(chrome.runtime.getPlatformInfo, 25e3);
