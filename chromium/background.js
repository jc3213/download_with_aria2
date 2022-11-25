chrome.contextMenus.create({
    title: chrome.runtime.getManifest().name,
    id: 'downwitharia2',
    contexts: ['link']
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    var {linkUrl, pageUrl} = info;
    aria2Download(linkUrl, pageUrl, getHostname(pageUrl));
});

chrome.storage.local.get(null, async json => {
    aria2Store = json['jsonrpc_uri'] ? json : await getDefaultOptions();
    aria2StartUp();
    aria2Capture();
});

chrome.storage.onChanged.addListener(changes => {
    Object.keys(changes).forEach(key => {
        var {newValue} = changes[key];
        aria2Store[key] = newValue;
    });
    if (changes['jsonrpc_uri'] || changes['secret_token']) {
        aria2Update();
    }
    if (changes['capture_mode']) {
        aria2Capture();
    }
});

async function captureOnCreated({id, finalUrl, referrer}) {
    var url = finalUrl;
    var referer = 'about:blank'.includes(referrer) ? await getCurrentTabUrl() : referrer;
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
    console.log(priority);
    if (priority < 2) {
        return;
    }
    priority += getCaptureFileData(fileSize, getFileExtension(filename));
    console.log(priority);
    if (priority > 2) {
        aria2Monitor[id].priority = priority;
        chrome.downloads.erase({id});
        aria2Download(url, referer, hostname, {out: filename});
    }
}

function aria2Capture() {
    if (aria2Store['capture_mode'] !== '0') {
        chrome.downloads.onCreated.addListener(captureOnCreated);
        chrome.downloads.onDeterminingFilename.addListener(captureOnFilename);
    }
    else {
        chrome.downloads.onCreated.removeListener(captureOnCreated);
        chrome.downloads.onDeterminingFilename.removeListener(captureOnFilename);
    }
}
