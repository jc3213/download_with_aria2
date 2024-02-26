importScripts('libs/aria2.js', 'crossbrowser.js');

chrome.downloads.onDeterminingFilename.addListener(({id, finalUrl, referrer, filename, fileSize}) => {
    if (!aria2Storage['capture_enabled'] || finalUrl.startsWith('data') || finalUrl.startsWith('blob')) {
        return;
    }
    var hostname = referrer === '' ? getHostname(finalUrl) : getHostname(referrer);
    var captured = aria2CaptureResult(hostname, getFileExtension(filename), fileSize);
    if (captured) {
        chrome.downloads.erase({id});
        aria2DownloadPrompt(finalUrl, {out: filename}, referrer, hostname);
    }
});

chrome.runtime.onStartup.addListener(chrome.runtime.getPlatformInfo);

chrome.storage.sync.get(null).then((json) => {
    aria2Storage = {...aria2Default, ...json};
    aria2RPC = new Aria2(aria2Storage['jsonrpc_scheme'], aria2Storage['jsonrpc_url'], aria2Storage['jsonrpc_secret']);
    aria2UpdateStorage();
    aria2ClientSetUp();
    aria2ContextMenus();
    aria2TaskManager();
});

var aria2Persistent = setInterval(chrome.runtime.getPlatformInfo, 26000);
