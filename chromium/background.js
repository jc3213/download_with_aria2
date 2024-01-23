aria2Changes.push({
    keys: ['capture_enabled'],
    action: aria2CaptureSwitch
});

async function captureOnCreated({id, finalUrl, referrer}) {
    var url = finalUrl;
    var referer = referrer === '' ? await getCurrentTabUrl() : referrer;
    var hostname = getHostname(referer);
    var priority = url.startsWith('blob') || url.startsWith('data') ? -1 : getCaptureHostname(hostname);
    aria2Monitor[id] = {url, referer, hostname, priority};
}

async function captureOnFilename({id, filename, fileSize}) {
    var {url, referer, hostname, priority} = aria2Monitor[id];
    if (priority < 0) {
        return;
    }
    priority += getCaptureFileData(fileSize, getFileExtension(filename));
    if (priority > 0) {
        chrome.downloads.erase({id});
        aria2Monitor[id].priority = priority;
        aria2Download(url, {out: filename}, referer, hostname);
    }
}

function aria2CaptureSwitch() {
    if (aria2Storage['capture_enabled']) {
        chrome.downloads.onCreated.addListener(captureOnCreated);
        chrome.downloads.onDeterminingFilename.addListener(captureOnFilename);
        return;
    }
    chrome.downloads.onCreated.removeListener(captureOnCreated);
    chrome.downloads.onDeterminingFilename.removeListener(captureOnFilename);
}
