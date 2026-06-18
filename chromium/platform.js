chrome.action = chrome.browserAction;

function captureDownloads(downloadItem) {
    let url = downloadItem.finalUrl;
    if (url.startsWith('data') || url.startsWith('blob')) {
        return;
    }
    let referer = downloadItem.referrer;
    let hostname = getHostname(referer || url);
    if (matchHostname(captureHosts, hostname)) {
        return;
    }
    let id = downloadItem.id;
    chrome.downloads.search({ id }, () => {
        chrome.downloads.erase({ id });
    });
    downloadHandler(url, referer, downloadItem.filename, hostname);
}

function captureHooking() {
    if (aria2Storage['capture_enabled']) {
        chrome.downloads.onDeterminingFilename.addListener(captureDownloads)
    }
}
