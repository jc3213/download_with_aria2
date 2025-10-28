function captureDownloads({ id, finalUrl, referrer, filename, fileSize }) {
    if (finalUrl.startsWith('data') || finalUrl.startsWith('blob')) {
        return;
    }
    let hostname = getHostname(referrer || finalUrl);
    let captured = captureEvaluate(hostname, filename, fileSize);
    if (captured) {
        chrome.downloads.erase({ id });
        downloadHandler(finalUrl, referrer, { out: filename });
    }
}

function captureHooking() {
    aria2Storage['capture_enabled']
        ? chrome.downloads.onDeterminingFilename.addListener(captureDownloads)
        : captureDisabled();
}

function captureDisabled() {
    chrome.downloads.onDeterminingFilename.removeListener(captureDownloads);
}
