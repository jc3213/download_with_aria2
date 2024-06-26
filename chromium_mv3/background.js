importScripts('libs/aria2.js', 'crossbrowser.js');

chrome.downloads.onDeterminingFilename.addListener(({id, finalUrl, referrer, filename, fileSize}) => {
    if (!aria2Storage['capture_enabled'] || finalUrl.startsWith('data') || finalUrl.startsWith('blob')) {
        return;
    }
    var hostname = referrer ? getHostname(referrer) : getHostname(finalUrl);
    var captured = aria2CaptureResult(hostname, getFileExtension(filename), fileSize);
    if (captured) {
        chrome.downloads.erase({id});
        aria2DownloadHandler(finalUrl, {out: filename}, referrer, hostname);
    }
});

chrome.runtime.onStartup.addListener(chrome.runtime.getPlatformInfo);

chrome.storage.sync.get(null).then((json) => {
    aria2UpdateStorage({...aria2Default, ...json});
    aria2ClientSetup();
});

var aria2Persistent = setInterval(chrome.runtime.getPlatformInfo, 26000);
