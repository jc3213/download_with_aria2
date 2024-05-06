function captureOnFilename({id, finalUrl, referrer, filename, fileSize}) {
    if (finalUrl.startsWith('data') || finalUrl.startsWith('blob')) {
        return;
    }
    var hostname = referrer ? getHostname(referrer) : getHostname(finalUrl);
    var captured = aria2CaptureResult(hostname, getFileExtension(filename), fileSize);
    if (captured) {
        chrome.downloads.erase({id});
        aria2DownloadHandler(finalUrl, {out: filename}, referrer, hostname);
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
    aria2UpdateStorage({...aria2Default, ...json});
    aria2ClientSetup();
});
