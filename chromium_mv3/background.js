importScripts('libs/aria2.js', 'crossbrowser.js');

function aria2CaptureFilename({id, finalUrl, referrer, filename, fileSize}) {
    if (!aria2RPC.alive || finalUrl.startsWith('data') || finalUrl.startsWith('blob')) {
        return;
    }
    let hostname = getHostname(referrer || finalUrl);
    let captured = aria2CaptureResult(hostname, filename, fileSize);
    if (captured) {
        chrome.downloads.erase({id});
        aria2DownloadHandler(finalUrl, referrer, {out: filename});
    }
}

function aria2CaptureSwitch() {
    if (aria2Storage['capture_enabled']) {
        chrome.downloads.onDeterminingFilename.addListener(aria2CaptureFilename);
    } else {
        chrome.downloads.onDeterminingFilename.removeListener(aria2CaptureFilename);
    }
}

chrome.runtime.onStartup.addListener(chrome.runtime.getPlatformInfo);

let aria2Persistent = setInterval(chrome.runtime.getPlatformInfo, 28000);
