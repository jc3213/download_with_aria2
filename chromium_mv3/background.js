importScripts('libs/aria2.js', 'crossbrowser.js');

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

function captureEnabled() {
    chrome.downloads.onDeterminingFilename.addListener(captureDownloads)
}

function captureDisabled() {
    chrome.downloads.onDeterminingFilename.removeListener(captureDownloads);
}

chrome.runtime.onStartup.addListener(chrome.runtime.getPlatformInfo);

let persistent = setInterval(chrome.runtime.getPlatformInfo, 28000);
