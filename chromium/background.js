async function captureOnFilename({id, finalUrl, referrer, filename, fileSize}) {
    if (testUrlScheme(finalUrl)) {
        return;
    }
    var referer = referrer === '' ? await getCurrentTabUrl() : referrer;
    var hostname = getHostname(referer);
    var captured = aria2CaptureResult(hostname, getFileExtension(filename), fileSize);
    if (captured) {
        chrome.downloads.erase({id});
        aria2Download(finalUrl, {out: filename}, referer, hostname);
    }
}

function aria2CaptureSwitch() {
    if (aria2Storage['capture_enabled']) {
        return chrome.downloads.onDeterminingFilename.addListener(captureOnFilename);
    }
    chrome.downloads.onDeterminingFilename.removeListener(captureOnFilename);
}

chrome.action = chrome.browserAction;
chrome.storage.sync.get(null, (json) => {
    aria2Storage = {...aria2Default, ...json};
    aria2MatchPattern();
    aria2ClientSetUp();
    aria2CaptureSwitch();
    aria2TaskManager();
    aria2ContextMenus();
});
