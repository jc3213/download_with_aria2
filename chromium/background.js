let aria2Default = {
    'jsonrpc_url': 'http://localhost:6800/jsonrpc',
    'jsonrpc_secret': '',
    'jsonrpc_retries': -1,
    'jsonrpc_timeout': 10,
    'manager_newtab': false,
    'manager_interval': 10,
    'ctxmenu_enabled': true,
    'ctxmenu_cascade': true,
    'ctxmenu_thisurl': true,
    'ctxmenu_thisimage': true,
    'ctxmenu_allimages': true,
    'notify_start': false,
    'notify_complete': false,
    'headers_override': false,
    'headers_useragent': 'Transmission/4.0.0',
    'headers_domains': [],
    'folder_defined': '',
    'folder_enabled': false,
    'folder_firefox': false,
    'proxy_server': '',
    'proxy_domains': [],
    'capture_enabled': false,
    'capture_webrequest': false,
    'capture_domains': [],
    'capture_extensions': [],
    'capture_filesize': 0
};

let aria2Storage = {};
let aria2Capture = {};
let aria2Config = {};
let aria2Version;
let aria2Active;
let aria2Manager = chrome.runtime.getURL('/pages/popup/popup.html');
let aria2Popup = 0;
let aria2Tabs = new Set();
let aria2Inspect = {};
let aria2Detect;
let aria2Manifest = chrome.runtime.getManifest();
let aria2Request = typeof browser !== 'undefined' ? ['requestHeaders'] : ['requestHeaders', 'extraHeaders'];

if (aria2Manifest.manifest_version === 3) {
    importScripts('libs/aria2.js', 'browserfix.js');
    setInterval(chrome.runtime.getPlatformInfo, 28000);
}

const aria2RPC = new Aria2();
aria2RPC.onopen = () => {
    aria2RPC.call(
        { method: 'aria2.getGlobalOption' }, { method: 'aria2.getVersion' }, { method: 'aria2.tellActive' }
    ).then(([{ result: options }, { result: version }, { result: active }]) => {
        captureHooking();
        aria2Version = version;
        aria2Active = new Set(active.map(({ gid }) => gid));
        RawData.forEach((key) => aria2Config[key] = options[key]);
        SizeData.forEach((key) => aria2Config[key] = RawToSize(options[key]));
        chrome.action.setBadgeBackgroundColor({ color: '#1C4CD4' });
        setIndicator();
    }).catch(aria2RPC.onclose);
};
aria2RPC.onclose = () => {
    captureDisabled();
    aria2Active = aria2Version = null;
    chrome.action.setBadgeBackgroundColor({ color: '#D33A26' });
    chrome.action.setBadgeText({ text: 'E' });
};
aria2RPC.onmessage = ({ method, params }) => {
    if (method === 'aria2.onBtDownloadComplete') {
        return;
    }
    let [{ gid }] = params;
    let handler = clientMessage[method] ?? clientMessage['fallback'];
    handler(gid);
    setIndicator();
};

function RawToSize(bytes) {
    if (bytes < 1024) {
        return bytes;
    }
    if (bytes < 1048576) {
        return (bytes / 10.24 | 0) / 100 + 'K';
    }
    return (bytes / 10485.76 | 0) / 100 + 'M';
}

const RawData = [
    'dir', 'file-allocation', 'max-concurrent-downloads', 'max-overall-download-limit', 'max-overall-upload-limit',
    'max-tries', 'retry-wait', 'split', 'max-connection-per-server', 'user-agent',
    'listen-port', 'bt-max-peers', 'follow-torrent', 'bt-remove-unselected-file', 'seed-ratio', 'seed-time'
];
const SizeData = ['disk-cache', 'min-split-size'];

const clientMessage = {
    'aria2.onDownloadStart': whenStarted,
    'aria2.onDownloadComplete': whenCompleted,
    'fallback': (gid) => aria2Active.delete(gid)
};

async function whenNotify(gid, type) {
    if (!aria2Storage['notify_' + type]) {
        return;
    }
    let [{ result }] = await aria2RPC.call({ method: 'aria2.tellStatus', params: [gid] });
    let { bittorrent, files } = result;
    let [{ path, uris }] = files;
    let title = chrome.i18n.getMessage('download_' + type);
    let message = bittorrent?.info?.name ?? path?.slice(path.lastIndexOf('/') + 1) ?? uris[0]?.uri ?? gid;
    chrome.notifications.create({ title, message, type: 'basic', iconUrl: '/icons/48.png' });
}

function whenStarted(gid) {
    if (aria2Active.has(gid)) {
        return;
    }
    aria2Active.add(gid);
    whenNotify(gid, 'start');
}

function whenCompleted(gid) {
    aria2Active.delete(gid);
    whenNotify(gid, 'complete');
}

async function downloadHandler(url, referer, options, tabId) {
    let hostname = getHostname(referer || url);
    if (MatchTest('proxy_domains', hostname)) {
        options['all-proxy'] = aria2Storage['proxy_server'];
    }
    if (aria2Storage['folder_enabled']) {
        options['dir'] ??= aria2Storage['folder_defined'] || null;
    }
    if (!MatchTest('headers_domains', hostname)) {
        let headers = aria2Inspect[tabId]?.[url] ?? Object.values(aria2Inspect).find((tab) => tab[url])?.[url] ?? [{ name: 'User-Agent', value: navigator.userAgent }, { name: 'Referer', value: referer }];
        if (aria2Storage['headers_override']) {
            let ua = headers.findIndex(({ name }) => name.toLowerCase() === 'user-agent');
            headers[ua].value = aria2Storage['headers_useragent'];
        }
        options['header'] = headers.map((header) => header.name + ': ' + header.value);
    }
    aria2RPC.call({ method: 'aria2.addUri', params: [[url], options] });
}

function aria2ImagesPrompt(referer, tabId) {
    aria2Detect = { referer, tabId };
    openPopupWindow('/pages/images/images.html', 680);
}

const ctxMenuMap = {
    'ctxmenu_thisurl': ({ id, url }, { linkUrl }) => downloadHandler(linkUrl, url, {}, id),
    'ctxmenu_thisimage': ({ id, url }, { srcUrl }) => downloadHandler(srcUrl, url, {}, id),
    'ctxmenu_allimages': ({ id, url }) => aria2ImagesPrompt(url, id)
};

chrome.contextMenus.onClicked.addListener((info, tab) => {
    ctxMenuMap[info.menuItemId]?.(tab, info);
});

const commandMap = {
    'open_options': () => chrome.runtime.openOptionsPage(),
    'open_new_download': () => openPopupWindow('/pages/newdld/newdld.html', 462)
};

chrome.commands.onCommand.addListener((command) => {
    commandMap[command]?.();
});

function systemRuntime() {
    return {
        storage: aria2Storage,
        manifest: aria2Manifest,
        options: aria2Config,
        version: aria2Version
    };
}

function storageChanged(response, json) {
    aria2RPC.disconnect();
    storageDispatch(json);
    chrome.storage.sync.set(json, response);
}

function optionsChanged(response, json) {
    [...RawData, ...SizeData].forEach((key) => aria2Config[key] = json[key]);
    aria2RPC.call({ method: 'aria2.changeGlobalOption', params: [json] }).then(response).catch(response);
}

function managerChanged(response, array) {
    aria2Storage['manager_queue'] = array;
    chrome.storage.sync.set({ 'manager_queue': array }, response);
}

function detectedImages(response) {
    let { tabId, referer } = aria2Detect;
    let tab = aria2Inspect[tabId];
    let json = systemRuntime();
    json.referer = referer;
    json.images = tab ? [...tab.images.values()] : [];
    json.request = aria2Request;
    json.tabId = aria2Popup;
    response(json);
}

const msgHandlers = {
    'system_runtime': (response) => response(systemRuntime()),
    'storage_update': storageChanged,
    'jsonrpc_update': optionsChanged,
    'manager_update': managerChanged,
    'inspect_images': detectedImages,
    'jsonrpc_download': (response, params) => aria2RPC.call(...params).then(response).catch(response),
    'open_new_download': () => openPopupWindow('/pages/newdld/newdld.html', 462)
};

chrome.runtime.onMessage.addListener(({ action, params }, sender, response) => {
    msgHandlers[action]?.(response, params);
    return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
    delete aria2Inspect[tabId];
});

const tabHandlers = {
    'loading': (tabId, url) => {
        if (url?.startsWith('http') && !aria2Tabs.has(tabId)) {
            aria2Tabs.add(tabId);
            aria2Inspect[tabId] = { images: new Map(), url };
        }
    },
    'complete': (tabId) => aria2Tabs.delete(tabId)
};

chrome.tabs.onUpdated.addListener((tabId, { status }, { url }) => {
    tabHandlers[status]?.(tabId, url);
});

chrome.webRequest.onBeforeSendHeaders.addListener(({ tabId, url, type, requestHeaders }) => {
    if (tabId === aria2Popup) {
        return;
    }
    let tab = aria2Inspect[tabId] ??= { images: new Map(), url };
    if (type === 'image') {
        let uri = url.replace(/[?#@].*$/, '');
        tab.images.set(uri, url);
    } else {
        tab[url] = requestHeaders;
    }
}, { urls: [ 'http://*/*', 'https://*/*' ], types: [ 'main_frame', 'sub_frame', 'image', 'other' ] }, aria2Request);

chrome.action ??= chrome.browserAction;

chrome.action.onClicked.addListener(() => {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
        let tab = tabs.find(({ url }) => url.startsWith(aria2Manager));
        tab ? chrome.tabs.update(tab.id, { active: true })
            : chrome.tabs.create({ url: aria2Manager, active: true });
    });
});

const MatchKeys = ['headers_domains', 'proxy_domains', 'capture_domains', 'capture_extensions'];

function MatchData(key) {
    let temp = aria2Storage[key];
    let data = temp.map((i) => `.${i}`);
    let dataSet = new Set(temp);
    let global = dataSet.has('*');
    aria2Capture[key] = { data, dataSet, global };
}

function MatchTest(key, string) {
    let { data, dataSet, global } = aria2Capture[key];
    return global || dataSet.has(string) || data.some((i) => string.endsWith(i));
}

function ctxMenuCreate(id, contexts, parentId) {
    chrome.contextMenus.create({
        id,
        title: chrome.i18n.getMessage(id),
        contexts,
        parentId,
        documentUrlPatterns: ['http://*/*', 'https://*/*']
    });
}

function storageDispatch(json) {
    aria2Storage = json;
    aria2RPC.url = json['jsonrpc_url'];
    aria2RPC.secret = json['jsonrpc_secret'];
    aria2RPC.retries = json['jsonrpc_retries'];
    aria2RPC.timeout = json['jsonrpc_timeout'];
    aria2RPC.connect();
    aria2Capture['capture_filesize'] = json['capture_filesize'] * 1048576;
    MatchKeys.forEach(MatchData);
    let popup = json['manager_newtab'] ? '' : '/pages/popup/popup.html?toolbar';
    chrome.action.setPopup({ popup });
    chrome.contextMenus.removeAll();
    if (!json['ctxmenu_enabled']) {
        return;
    }
    let menuId;
    if (json['ctxmenu_cascade']) {
        menuId = 'extension_name';
        ctxMenuCreate(menuId, ['link', 'image', 'page']);
    }
    if (json['ctxmenu_thisurl']) {
        ctxMenuCreate('ctxmenu_thisurl', ['link'], menuId);
    }
    if (json['ctxmenu_thisimage']) {
        ctxMenuCreate('ctxmenu_thisimage', ['image'], menuId);
    }
    if (json['ctxmenu_allimages']) {
        ctxMenuCreate('ctxmenu_allimages', ['page'], menuId);
    }
}

chrome.storage.sync.get(null, (json) => {
    let storage = { ...aria2Default, ...json };
    storageDispatch(storage);
});

function captureEvaluate(hostname, filename, fileSize) {
    return !(
        MatchTest('capture_domains', hostname) ||
        MatchTest('capture_extensions', filename) ||
        aria2Capture['capture_filesize'] > 0 &&
        aria2Capture['capture_filesize'] > fileSize
    );
}

function getHostname(url) {
    let host = url.split('/')[2];
    return host.includes('@') ? host.slice(host.indexOf('@') + 1) : host;
}

function setIndicator() {
    let number = aria2Active.size;
    chrome.action.setBadgeText({ text: !number ? '' : String(number) });
}

function openPopupWindow(url, winSize) {
    chrome.windows.getCurrent(({ top, left, height, width }) => {
        top = (top + height - winSize) / 2 | 0;
        left = (left + width - 710) / 2 | 0;
        height = winSize;
        width = 698;
        chrome.tabs.get(aria2Popup, (tab) => {
            if (chrome.runtime.lastError) {
                chrome.windows.create({ url, type: 'popup', left, width, top, height }, (popup) => {
                    aria2Popup = popup.tabs[0].id;
                });
            } else {
                chrome.windows.update(tab.windowId, { focused: true, left, width, top, height });
                chrome.tabs.update(aria2Popup, { url, active: true });
            }
        });
    });
}
