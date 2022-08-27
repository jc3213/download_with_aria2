chrome.contextMenus.create({
    title: chrome.runtime.getManifest().name,
    id: 'downwitharia2',
    contexts: ['link']
});

chrome.contextMenus.onClicked.addListener(({linkUrl, pageUrl}) => {
    chromeDownload(linkUrl, getHostname(pageUrl), {referer: pageUrl});
});

chrome.storage.local.get(null, async json => {
    aria2Store = json['jsonrpc_uri'] ? json : await fetch('/options.json').then(response => response.json());
    aria2StartUp();
    aria2Capture();
    if (!json['jsonrpc_uri']) {
        chrome.storage.local.set(aria2Store);
    }
});

chrome.storage.onChanged.addListener(changes => {
    Object.entries(changes).forEach(([key, {newValue}]) => aria2Store[key] = newValue);
    if (changes['jsonrpc_uri'] || changes['secret_token']) {
        aria2Update();
    }
    if (changes['capture_mode']) {
        aria2Capture();
    }
});

function chromeDownload(url, referer, options) {
    chrome.cookies.getAll({url}, cookies => {
        aria2Download(url, hostname, options, cookies);
    });
}

function downloadCapture({id, finalUrl, referrer, filename, fileSize}) {
    if (finalUrl.startsWith('blob') || finalUrl.startsWith('data')) {
        return;
    }
    chrome.tabs.query({active: true, currentWindow: true}, ([tab]) => {
        var referer = referrer && referrer !== 'about:blank' ? referrer : tab.url;
        var hostname = getHostname(referer);
        if (getCaptureFilter(hostname, getFileExtension(filename), fileSize)) {
            chrome.downloads.erase({id});
            chromeDownload(finalUrl, hostname, {referer, out: filename});
        }
    });
}

function aria2Capture() {
    if (aria2Store['capture_mode'] !== '0') {
        chrome.downloads.onDeterminingFilename.addListener(downloadCapture);
    }
    else {
        chrome.downloads.onDeterminingFilename.removeListener(downloadCapture);
    }
}
