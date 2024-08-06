function aria2CaptureFilename({id, finalUrl, referrer, filename, fileSize}) {
    if (finalUrl.startsWith('data') || finalUrl.startsWith('blob')) {
        return;
    }
    var hostname = referrer ? getHostname(referrer) : getHostname(finalUrl);
    var captured = aria2CaptureResult(hostname, filename, fileSize);
    if (captured) {
        chrome.downloads.erase({id});
        aria2DownloadHandler(finalUrl, {out: filename}, referrer, hostname);
    }
}

function aria2CaptureSwitch() {
    if (aria2Storage['capture_enabled']) {
        return chrome.downloads.onDeterminingFilename.addListener(aria2CaptureFilename);
    }
    chrome.downloads.onDeterminingFilename.removeListener(aria2CaptureFilename);
}
