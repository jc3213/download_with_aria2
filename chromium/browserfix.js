function captureDownloads({ id, finalUrl, referrer, filename }) {
    if (finalUrl.startsWith('data') || finalUrl.startsWith('blob')) {
        return;
    }
    let hostname = getHostname(referrer || finalUrl);
    if (!matchHostname(captureHosts, hostname)) {
        chrome.downloads.erase({ id });
        downloadHandler(finalUrl, referrer, filename, hostname);
    }
}

function captureHooking() {
    if (aria2Storage['capture_enabled']) {
        chrome.downloads.onDeterminingFilename.addListener(captureDownloads)
    }
}

function captureDisabled() {
    chrome.downloads.onDeterminingFilename.removeListener(captureDownloads);
}
