chrome.contextMenus.create({
    title: chrome.runtime.getManifest().name,
    id: 'downwitharia2',
    contexts: ['link']
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    var {linkUrl, pageUrl} = info;
    aria2Download(linkUrl, getHostname(pageUrl), {referer: pageUrl});
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

function aria2Download(url, hostname, options) {
    chrome.cookies.getAll({url}, cookies => {
        options['user-agent'] = aria2Store['user_agent'];
        options['header'] = getRequestHeaders(cookies);
        options['all-proxy'] = getProxyServer(hostname);
        options['dir'] = getDownloadFolder();
        aria2RPC.message('aria2.addUri', [[url], options]).then(result => aria2WhenStart(url));
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
            aria2Download(finalUrl, hostname, {referer, out: filename});
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
