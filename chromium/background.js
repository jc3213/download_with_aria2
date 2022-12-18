chrome.contextMenus.create({
    title: chrome.runtime.getManifest().name,
    id: 'downwitharia2',
    contexts: ['link']
});

chrome.contextMenus.onClicked.addListener(({menuItemId, linkUrl}, {id, url}) => {
    if (menuItemId === 'downwitharia2') {
        aria2Download(linkUrl, url, getHostname(url));
    }
});

chrome.storage.local.get(null, async json => {
    aria2Store = 'jsonrpc_uri' in json ? json : await getDefaultOptions();
    aria2StartUp();
    aria2Capture();
});

chrome.storage.onChanged.addListener(changes => {
    Object.keys(changes).forEach(key => {
        var {newValue} = changes[key];
        aria2Store[key] = newValue;
    });
    if ('jsonrpc_uri' in changes || 'secret_token' in changes) {
        aria2Update();
    }
    if ('capture_enabled' in changes) {
        aria2Capture();
    }
});

async function captureOnCreated({id, finalUrl, referrer}) {
    var url = finalUrl;
    var referer = referrer === '' ? await getCurrentTabUrl() : referrer;
    var hostname = getHostname(referer);
    if (finalUrl.startsWith('blob') || finalUrl.startsWith('data')) {
        var priority = 0;
    }
    else {
        priority = getCaptureHostname(hostname);
    }
    aria2Monitor[id] = {url, referer, hostname, priority};
}

async function captureOnFilename({id, filename, fileSize}) {
    var {url, referer, hostname, priority} = aria2Monitor[id];
    if (priority < 1) {
        return;
    }
    priority += getCaptureFileData(fileSize, getFileExtension(filename));
    if (priority > 1) {
        chrome.downloads.erase({id});
        aria2Monitor[id].priority = priority;
        aria2Download(url, referer, hostname, {out: filename});
    }
}

function aria2Capture() {
    if (aria2Store['capture_enabled']) {
        chrome.downloads.onCreated.addListener(captureOnCreated);
        chrome.downloads.onDeterminingFilename.addListener(captureOnFilename);
    }
    else {
        chrome.downloads.onCreated.removeListener(captureOnCreated);
        chrome.downloads.onDeterminingFilename.removeListener(captureOnFilename);
    }
}
