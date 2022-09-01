importScripts('/libs/aria2.js');
importScripts('/libs/tools.js');
importScripts('/common.js');

aria2StartUp();

chrome.runtime.onStartup.addListener(() => {
    aria2StartUp();
});

chrome.runtime.onInstalled.addListener(details => {
    chrome.contextMenus.create({
        title: chrome.runtime.getManifest().name,
        id: 'downwitharia2',
        contexts: ['link']
    });
});

chrome.contextMenus.onClicked.addListener(({linkUrl, pageUrl}) => {
    aria2Download(linkUrl, getHostname(pageUrl), {referer: pageUrl});
});

chrome.storage.onChanged.addListener(changes => {
    Object.keys(changes).forEach(key => {
        var {newValue} = changes[key];
        aria2Store[key] = newValue;
    });
    if (changes['jsonrpc_uri'] || changes['secret_token']) {
        aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
    }
});

chrome.downloads.onDeterminingFilename.addListener(async ({id, finalUrl, referrer, filename, fileSize}) => {
    if (aria2Store['capture_mode'] === '0' || finalUrl.startsWith('blob') || finalUrl.startsWith('data')) {
        return;
    }
    var referer = referrer && referrer !== 'about:blank' ? referrer : await chrome.tabs.query({active: true, currentWindow: true}).then(([{url}]) => url);
    var hostname = getHostname(referer);
    if (getCaptureFilter(hostname, getFileExtension(filename), fileSize)) {
        chrome.downloads.erase({id});
        aria2Download(finalUrl, hostname, {referer, out: filename});
    }
});

async function aria2StartUp() {
    var json = await chrome.storage.local.get(null);
    aria2Store = json['jsonrpc_uri'] ? json : await getDefaultOptions();
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
}

async function aria2Download(url, hostname, options) {
    var cookies = await chrome.cookies.getAll({url})
    options['user-agent'] = aria2Store['user_agent'];
    options['header'] = getRequestHeaders(cookies);
    options['all-proxy'] = getProxyServer(hostname);
    options['dir'] = getDownloadFolder();
    aria2RPC.message('aria2.addUri', [[url], options]).then(result => aria2WhenStart(url));
}