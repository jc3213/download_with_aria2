importScripts('/libs/aria2.js', '/libs/tools.js', '/common.js', '/indicator.js');

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

chrome.contextMenus.onClicked.addListener((info, tab) => {
    var {linkUrl, pageUrl} = info;
    aria2Download(linkUrl, pageUrl, getHostname(pageUrl));
});

chrome.storage.onChanged.addListener(changes => {
    Object.keys(changes).forEach(key => {
        var {newValue} = changes[key];
        aria2Store[key] = newValue;
    });
    if (changes['jsonrpc_uri'] || changes['secret_token']) {
        aria2Update();
    }
});

chrome.downloads.onCreated.addListener(async ({id, finalUrl, referrer}) => {
    var url = finalUrl;
    var referer = 'about:blank'.includes(referrer) ? await getCurrentTabUrl() : referrer;
    var hostname = getHostname(referer);
    if (aria2Store['capture_mode'] === '0' || finalUrl.startsWith('blob') || finalUrl.startsWith('data')) {
        var priority = 0;
    }
    else {
        priority = getCaptureHostname(hostname);
    }
    aria2Monitor[id] = {url, referer, hostname, priority};
});

chrome.downloads.onDeterminingFilename.addListener(async ({id, filename, fileSize}) => {
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
});

async function aria2StartUp() {
    var json = await chrome.storage.local.get(null);
    aria2Store = json['jsonrpc_uri'] ? json : await getDefaultOptions();
    aria2Update();
    self.screen = await chrome.windows.getCurrent();
}

function aria2Update() {
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
    aria2Status();
}
