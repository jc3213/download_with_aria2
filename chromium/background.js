chrome.contextMenus.create({
    title: chrome.runtime.getManifest().name,
    id: 'downwitharia2',
    contexts: ['link']
});

chrome.contextMenus.onClicked.addListener(({menuItemId, linkUrl}, {id, url}) => {
    if (menuItemId === 'downwitharia2') {
        var {hostname} = getUrlComponents(url);
        aria2Download(linkUrl, url, hostname);
    }
});

chrome.storage.local.get(null, json => {
    aria2Store = {...aria2Default, ...json};
    aria2StartUp();
    aria2Capture();
    aria2Manager();
});

function aria2Update(changes) {
    if ('jsonrpc_uri' in changes || 'jsonrpc_token' in changes) {
        aria2StartUp();
    }
    if ('capture_enabled' in changes) {
        aria2Capture();
    }
    if ('manager_newtab' in changes) {
        aria2Manager();
    }
}

async function captureOnCreated({id, finalUrl, referrer}) {
    var url = finalUrl;
    var referer = referrer === '' ? await getCurrentTabUrl() : referrer;
    var {hostname} = getUrlComponents(referer);
    if (finalUrl.startsWith('blob') || finalUrl.startsWith('data')) {
        var priority = -1;
    }
    else {
        priority = getCaptureHostname(hostname);
    }
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
