let aria2Default = {
    'jsonrpc_scheme': 'http',
    'jsonrpc_url': 'localhost:6800/jsonrpc',
    'jsonrpc_secret': '',
    'jsonrpc_retries': -1,
    'jsonrpc_timeout': 10,
    'manager_newtab': false,
    'manager_interval': 10,
    'context_enabled': true,
    'context_cascade': true,
    'context_thisurl': true,
    'context_thisimage': true,
    'context_allimages': true,
    'notify_start': false,
    'notify_complete': false,
    'headers_override': false,
    'headers_useragent': 'Transmission/4.0.0',
    'headers_exclude': [],
    'folder_defined': '',
    'folder_enabled': false,
    'folder_firefox': false,
    'proxy_server': '',
    'proxy_include': [],
    'capture_enabled': false,
    'capture_webrequest': false,
    'capture_host_exclude': [],
    'capture_type_exclude': [],
    'capture_size_exclude': 0
};

let aria2RPC;
let aria2Storage = {};
let aria2Updated = {};
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

async function aria2DownloadHandler(url, referer, options, tabId) {
    let hostname = getHostname(referer || url);
    if (aria2Updated['proxy_include'].test(hostname)) {
        options['all-proxy'] = aria2Storage['proxy_server'];
    }
    if (aria2Storage['folder_enabled']) {
        options['dir'] ??= aria2Storage['folder_defined'] || null;
    }
    if (!aria2Updated['headers_exclude'].test(hostname)) {
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
    'aria2c_this_url': ({ id, url }, { linkUrl }) => aria2DownloadHandler(linkUrl, url, {}, id),
    'aria2c_this_image': ({ id, url }, { srcUrl }) => aria2DownloadHandler(srcUrl, url, {}, id),
    'aria2c_all_images': ({ id, url }) => aria2ImagesPrompt(url, id)
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
    aria2RPC.scheme = json['jsonrpc_scheme'];
    aria2RPC.url = json['jsonrpc_url'];
    aria2RPC.secret = json['jsonrpc_secret'];
    aria2StorageUpdate(json);
    chrome.storage.sync.set(aria2Storage, response);
}

function optionsChanged(response, options) {
    aria2ConfigUpdate(options);
    aria2RPC.call({ method: 'aria2.changeGlobalOption', params: [options] }).then(response).catch(response);
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
    'jsonrpc_download': (response, params) => aria2RPC.call(...params).then(response).catch(response),
    'options_storage': storageChanged,
    'options_jsonrpc': optionsChanged,
    'inspect_images': detectedImages,
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
        let uri = url.match(/^[^#?@]+/)[0];
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

function aria2StorageUpdate(json) {
    let menuId;
    let popup = json['manager_newtab'] ? '' : '/pages/popup/popup.html?toolbar';
    aria2Storage = json;
    aria2RPC.retries = json['jsonrpc_retries'];
    aria2RPC.timeout = json['jsonrpc_timeout'];
    aria2RPC.connect();
    aria2Updated['manager_interval'] = json['manager_interval'] * 1000;
    aria2Updated['headers_exclude'] = getMatchPattern(json['headers_exclude']);
    aria2Updated['proxy_include'] = getMatchPattern(json['proxy_include']);
    aria2Updated['capture_host_exclude'] = getMatchPattern(json['capture_host_exclude']);
    aria2Updated['capture_type_exclude'] = getMatchPattern(json['capture_type_exclude'], true);
    aria2Updated['capture_size_exclude'] = json['capture_size_exclude'] * 1048576;
    chrome.action.setPopup({ popup });
    chrome.contextMenus.removeAll();
    if (!json['context_enabled']) {
        return;
    }
    if (json['context_cascade']) {
        menuId = 'aria2c_contextmenu';
        setContextMenu(menuId, 'extension_name', ['link', 'image', 'page']);
    }
    if (json['context_thisurl']) {
        setContextMenu('aria2c_this_url', 'contextmenu_thisurl', ['link'], menuId);
    }
    if (json['context_thisimage']) {
        setContextMenu('aria2c_this_image', 'contextmenu_thisimage', ['image'], menuId);
    }
    if (json['context_allimages']) {
        setContextMenu('aria2c_all_images', 'contextmenu_allimages', ['page'], menuId);
    }
}

chrome.storage.sync.get(null, (json) => {
    let storage = { ...aria2Default, ...json };
    aria2RPC = new Aria2(storage['jsonrpc_scheme'], storage['jsonrpc_url'], storage['jsonrpc_secret']);
    aria2RPC.onopen = aria2ClientOpened;
    aria2RPC.onclose = aria2ClientClosed;
    aria2RPC.onmessage = aria2ClientMessage;
    aria2StorageUpdate(storage);
});

const RawData = [
    'dir', 'max-concurrent-downloads', 'max-overall-download-limit', 'max-overall-upload-limit',
    'max-tries', 'retry-wait', 'split', 'max-connection-per-server', 'user-agent',
    'listen-port', 'bt-max-peers', 'follow-torrent', 'bt-remove-unselected-file', 'seed-ratio', 'seed-time'];
const SizeData = ['disk-cache', 'min-split-size'];

function RawToSize(bytes) {
    if (bytes < 1024) {
        return bytes;
    }
    if (bytes < 1048576) {
        return (bytes / 10.24 | 0) / 100 + 'K';
    }
    return (bytes / 10485.76 | 0) / 100 + 'M';
}

function aria2ConfigUpdate(json) {
    RawData.forEach((key) => aria2Config[key] = json[key]);
    SizeData.forEach((key) => aria2Config[key] = RawToSize(json[key]));
}

function aria2ClientOpened() {
    aria2RPC.call(
        { method: 'aria2.getGlobalOption' }, { method: 'aria2.getVersion' }, { method: 'aria2.tellActive' }
    ).then(([{ result: options }, { result: version }, { result: active }]) => {
        captureHooking();
        aria2ConfigUpdate(options);
        aria2Version = version;
        aria2Active = new Set(active.map(({ gid }) => gid));
        chrome.action.setBadgeBackgroundColor({ color: '#1C4CD4' });
        setIndicator();
    }).catch(aria2ClientClosed);
}

function aria2ClientClosed() {
    captureDisabled();
    aria2Active = aria2Config = aria2Version = null;
    chrome.action.setBadgeBackgroundColor({ color: '#D33A26' });
    chrome.action.setBadgeText({ text: 'E' });
}

async function whenNotify(gid, type) {
    if (!aria2Storage['notify_' + type]) {
        return;
    }
    let [{ result }] = await aria2RPC.call({ method: 'aria2.tellStatus', params: [gid] });
    let { bittorrent, files } = result;
    let [{ path, uris }] = files;
    let title = chrome.i18n.getMessage('download_' + type);
    let message = bittorrent?.info?.name ?? path?.slice(path.lastIndexOf('/') + 1) ?? uris[0]?.uri ?? gid;
    showNotification(title, message);
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

const clientHandlers = {
    'aria2.onDownloadStart': whenStarted,
    'aria2.onDownloadComplete': whenCompleted,
    'fallback': (gid) => aria2Active.delete(gid)
};

function aria2ClientMessage({ method, params }) {
    if (method === 'aria2.onBtDownloadComplete') {
        return;
    }
    let [{ gid }] = params;
    let handler = clientHandlers[method] ?? clientHandlers['fallback'];
    handler(gid);
    setIndicator();
}

function aria2CaptureResult(hostname, filename, filesize) {
    if (aria2Updated['capture_host_exclude'].test(hostname) ||
        aria2Updated['capture_type_exclude'].test(filename) ||
        aria2Updated['capture_size_exclude'] > 0 &&
        aria2Updated['capture_size_exclude'] > filesize) {
        return false;
    }
    return true;
}

function getHostname(url) {
    let path = url.slice(url.indexOf(':') + 3);
    let host = path.slice(0, path.indexOf('/'));
    return host.slice(host.indexOf('@') + 1);
}

function getMatchPattern(array, isFile) {
    if (array.length === 0) {
        return /!/;
    }
    if (array.includes('*')) {
        return /.*/;
    }
    if (isFile) {
        return new RegExp('^.*\\.(' + array.join('|') + ')$');
    }
    return new RegExp('^(' + array.join('|').replace(/\./g, '\\.').replace(/\*\\\./g, '([^.]+\\.)*').replace(/\\\.\*/g, '(\\.[^.]+)*') + ')$');
}

function setContextMenu(id, i18n, contexts, parentId) {
    chrome.contextMenus.create({
        id,
        title: chrome.i18n.getMessage(i18n),
        contexts,
        parentId,
        documentUrlPatterns: ['http://*/*', 'https://*/*']
    });
}

function setIndicator() {
    let number = aria2Active.size;
    chrome.action.setBadgeText({ text: !number ? '' : String(number) });
}

function showNotification(title, message) {
    chrome.notifications.create({
        title,
        message,
        type: 'basic',
        iconUrl: '/icons/48.png'
    });
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
