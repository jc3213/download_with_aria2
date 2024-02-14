var aria2History = {};
var aria2Monitor = {};

function captureOnFilename({id, finalUrl, referrer, filename, fileSize}) {
    if (aria2History[finalUrl]) {
        delete aria2History[finalUrl];
        return;
    }
    chrome.downloads.erase({id});
    aria2Monitor[id] = {url: finalUrl, referrer, filename, fileSize};
    aria2History[finalUrl] = id;
}

async function captureOnErased(id) {
    var {url, referrer, filename, fileSize} = aria2Monitor[id];
    if (testUrlScheme(url)) {
        return aria2NativeDownload(url, referrer, filename);
    }
    var referer = referrer === '' ? await getCurrentTabUrl() : referrer;
    var hostname = getHostname(referer);
    var captured = aria2CaptureResult(hostname, getFileExtension(filename), fileSize);
    if (captured) {
        delete aria2History[url];
        return aria2Download(url, {out: filename}, referer, hostname);
    }
    aria2NativeDownload(url, referrer, filename);
}

function aria2NativeDownload(url, referrer, filename) {
    chrome.cookies.getAll({url}, (cookies) => {
        var headers = cookies.map(({name, value}) => ({name, value}));
        chrome.downloads.download({url, filename, headers: [{name: 'Referrer', value: referrer}, ...headers]});
    });
}

function aria2CaptureSwitch() {
    if (aria2Storage['capture_enabled']) {
        chrome.downloads.onDeterminingFilename.addListener(captureOnFilename);
        return chrome.downloads.onErased.addListener(captureOnErased);
    }
    chrome.downloads.onDeterminingFilename.removeListener(captureOnFilename);
    chrome.downloads.onErased.removeListener(captureOnErased);
}

chrome.action = chrome.browserAction;
chrome.storage.sync.get(null, (json) => {
    aria2Storage = {...aria2Default, ...json};
    aria2MatchPattern();
    aria2ClientSetUp();
    aria2CaptureSwitch();
    aria2TaskManager();
    aria2ContextMenus();
});
