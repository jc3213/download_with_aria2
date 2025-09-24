function aria2CaptureFilename({ id, finalUrl, referrer, filename, fileSize }) {
    if (finalUrl.startsWith('data') || finalUrl.startsWith('blob')) {
        return;
    }
    let hostname = getHostname(referrer || finalUrl);
    let captured = aria2CaptureResult(hostname, filename, fileSize);
    if (captured) {
        chrome.downloads.erase({ id });
        aria2DownloadHandler(finalUrl, referrer, { out: filename });
    }
}

function captureHooking() {
    aria2Storage['capture_enabled']
        ? chrome.downloads.onDeterminingFilename.addListener(aria2CaptureFilename)
        : captureDisabled();
}

function captureDisabled() {
    chrome.downloads.onDeterminingFilename.removeListener(aria2CaptureFilename);
}
