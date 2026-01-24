const addonManager = chrome.runtime.getURL('/pages/popup/popup.html');
const addonImages = chrome.runtime.getURL('/pages/images/images.html');
const addonDownload = chrome.runtime.getURL('/pages/newdld/newdld.html');
const systemManifest = chrome.runtime.getManifest();
const systemFirefox = systemManifest.browser_specific_settings;
const systemHeaders = systemFirefox ? ['requestHeaders'] : ['requestHeaders', 'extraHeaders'];
const systemStorage = {
    'jsonrpc_url': 'ws://localhost:6800/jsonrpc',
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

if (systemManifest.manifest_version === 3) {
    importScripts('libs/aria2.js', 'browserfix.js');
    setInterval(chrome.runtime.getPlatformInfo, 28000);
}

let aria2Storage = {};
let aria2Config = {};
let aria2Match = {};
let aria2Version;
let aria2Active = new Set();
let aria2Inspect = new Map();

const aria2RPC = new Aria2();
aria2RPC.onopen = () => {
    aria2RPC.call([
        { method: 'aria2.getGlobalOption' }, { method: 'aria2.getVersion' }, { method: 'aria2.tellActive' }
    ]).then(({ result: [[options], [version], [active]] }) => {
        for (let key of RawKeys) {
            aria2Config[key] = options[key];
        }
        for (let key of SizeKeys) {
            aria2Config[key] = RawToSize(options[key]);
        }
        aria2Version = version;
        for (let { gid } of active) {
            aria2Active.add(gid);
        }
        captureHooking();
        toolbarCounter();
        chrome.action.setBadgeBackgroundColor({ color: '#1C4CD4' });
    }).catch(aria2RPC.onclose);
};
aria2RPC.onclose = () => {
    aria2Version = null;
    aria2Active = new Set();
    captureDisabled();
    chrome.action.setBadgeText({ text: 'E' });
    chrome.action.setBadgeBackgroundColor({ color: '#D33A26' });
};
aria2RPC.onmessage = ({ method, params }) => {
    if (method === 'aria2.onBtDownloadComplete') {
        return;
    }
    let [{ gid }] = params;
    if (method === 'aria2.onDownloadStart') {
        if (!aria2Active.has(gid)) {
            aria2Active.add(gid);
            showNotify(gid, 'start');
        }
    } else {
        aria2Active.delete(gid);
        if (method === 'aria2.onDownloadComplete') {
            showNotify(gid, 'complete');
        }
    }
    toolbarCounter();
};

async function showNotify(gid, type) {
    if (!aria2Storage['notify_' + type]) {
        return;
    }
    let { result: { bittorrent, files: [{ path, uris }] } } = await aria2RPC.call({ method: 'aria2.tellStatus', params: [gid] });
    let title = chrome.i18n.getMessage('download_' + type);
    let message = bittorrent?.info?.name ?? path?.substring(path.lastIndexOf('/') + 1) ?? uris[0]?.uri ?? gid;
    chrome.notifications.create({ title, message, type: 'basic', iconUrl: '/icons/48.png' });
}

function RawToSize(bytes) {
    if (bytes < 1024) {
        return bytes;
    }
    if (bytes < 1048576) {
        return (bytes / 10.24 | 0) / 100 + 'K';
    }
    return (bytes / 10485.76 | 0) / 100 + 'M';
}

const RawKeys = [
    'dir', 'file-allocation', 'allow-overwrite', 'max-concurrent-downloads',
    'max-tries', 'retry-wait', 'split', 'max-connection-per-server', 'user-agent',
    'listen-port', 'bt-max-peers', 'enable-dht', 'enable-dht6', 'follow-torrent', 'bt-remove-unselected-file', 'seed-ratio', 'seed-time'
];
const SizeKeys = ['disk-cache', 'min-split-size', 'max-overall-download-limit', 'max-overall-upload-limit'];

function downloadHeaders(tabId, url, referer) {
    let result = [];
    let headers;
    let oldUA = navigator.userAgent;
    if (aria2Inspect.has(tabId)) {
        headers = aria2Inspect.get(tabId)[url];
    } else {
        for (let tab of aria2Inspect.values()) {
            headers = tab[url];
            if (headers) {
                break;
            }
        }
    }
    headers ??= [{ name: 'Referer', value: referer }];
    for (let { name, value } of headers) {
        let lower = name.toLowerCase();
        if (lower === 'user-agent') {
            oldUA = value;
        } else {
            result.push(name + ': ' + value);
        }
    }
    let newUA = aria2Storage['headers_override'] ? aria2Storage['headers_useragent'] : oldUA;
    result.push('User-Agent: ' + newUA);
    return result;
}

function downloadDirectory(filename) {
    let dir = null;
    let out = filename;
    let user = aria2Storage['folder_defined'];
    if (out) {
        let idx = Math.max(out.lastIndexOf('/'), out.lastIndexOf('\\')) + 1;
        if (idx > 0) {
            dir = filename.substring(0, idx);
            out = filename.substring(idx);
        }
    }
    if (aria2Storage['folder_enabled'] &&
        !(systemFirefox && aria2Storage['folder_firefox']) &&
        user) {
        dir = user;
    }
    return { dir, out };
}

function downloadHandler(url, referer, filename, hostname, tabId) {
    let options = downloadDirectory(filename);
    hostname ??= getHostname(referer);
    if (aria2Match['proxy_domains'](hostname)) {
        options['all-proxy'] = aria2Storage['proxy_server'];
    }
    if (!aria2Match['headers_domains'](hostname)) {
        options['header'] = downloadHeaders(tabId, url, referer);
    }
    aria2RPC.call({ method: 'aria2.addUri', params: [[url], options] });
}

const ctxMenuMap = {
    'ctxmenu_thisurl': ({ id, url }, { linkUrl }) => downloadHandler(linkUrl, url, null, null, id),
    'ctxmenu_thisimage': ({ id, url }, { srcUrl }) => downloadHandler(srcUrl, url, null, null, id),
    'ctxmenu_allimages': ({ id, url }) => openPopupWindow(addonImages + '?id=' + id + '&referer=' + encodeURIComponent(url), 680)
};

chrome.contextMenus.onClicked.addListener((info, tab) => {
    ctxMenuMap[info.menuItemId]?.(tab, info);
});

const commandMap = {
    'open_options': () => chrome.runtime.openOptionsPage(),
    'open_new_download': () => openPopupWindow(addonDownload, 462)
};

chrome.commands.onCommand.addListener((command) => {
    commandMap[command]?.();
});

function systemRuntime() {
    return {
        storage: aria2Storage,
        manifest: systemManifest,
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
    for (let key of RawKeys) {
        aria2Config[key] = json[key];
    }
    for (let key of SizeKeys) {
        aria2Config[key] = json[key];
    }
    aria2RPC.call({ method: 'aria2.changeGlobalOption', params: [json] }).then(response).catch(response);
}

function managerChanged(response, array) {
    aria2Storage['manager_queue'] = array;
    chrome.storage.sync.set({ 'manager_queue': array }, response);
}

function detectedImages(response, id) {
    let json = systemRuntime();
    let tab = aria2Inspect.get(id);
    json.images = tab ? [...tab.images.values()] : [];
    json.request = systemHeaders;
    response(json);
}

const messageDispatch = {
    'system_runtime': (response) => response(systemRuntime()),
    'storage_update': storageChanged,
    'jsonrpc_update': optionsChanged,
    'manager_update': managerChanged,
    'inspect_images': detectedImages,
    'jsonrpc_download': (response, params) => aria2RPC.call(params).then(response).catch(response),
    'open_new_download': () => openPopupWindow(addonDownload, 462)
};

chrome.runtime.onMessage.addListener(({ action, params }, sender, response) => {
    messageDispatch[action]?.(response, params);
    return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
    aria2Inspect.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, { url }) => {
    if (url) {
        aria2Inspect.delete(tabId);
    }
});

chrome.webRequest.onBeforeSendHeaders.addListener(({ tabId, url, type, requestHeaders }) => {
    let tab = aria2Inspect.get(tabId);
    if (!tab) {
        tab = { images: new Map() };
        aria2Inspect.set(tabId, tab);
    }
    if (type === 'image') {
        let uri = url.replace(/[?#@].*$/, '');
        tab.images.set(uri, url);
    } else {
        tab[url] = requestHeaders;
    }
}, { urls: [ 'http://*/*', 'https://*/*' ], types: [ 'main_frame', 'sub_frame', 'image', 'other' ] }, systemHeaders);

chrome.action ??= chrome.browserAction;

chrome.action.onClicked.addListener(() => {
    chrome.tabs.query({ url: addonManager, currentWindow: true }, ([tab]) => {
        if (tab) {
            chrome.tabs.update(tab.id, { active: true });
        } else {
            chrome.tabs.create({ url: addonManager, active: true });
        }
    });
});

function MatchHost(key) {
    let data = aria2Storage[key];
    let rules = {};
    for (let i of data) {
        rules[i] = true;
    }
    let empty = data.length === 0;
    let global = Boolean(rules['*']);
    aria2Match[key] = (host) => {
        if (empty) {
            return false;
        }
        if (global) {
            return true;
        }
        while (true) {
            if (rules[host]) {
                return true;
            }
            let dot = host.indexOf('.');
            if (dot < 0) {
                return false;
            }
            host = host.substring(dot + 1);
        }
    };
}

function MatchSize(key) {
    let data = aria2Storage[key] * 1048576;
    let enabled = data > 0;
    aria2Match[key] = (size) => enabled && data > size;
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
    MatchHost('headers_domains');
    MatchHost('proxy_domains');
    MatchHost('capture_domains');
    MatchHost('capture_extensions');
    MatchSize('capture_filesize');
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
    let storage = { ...systemStorage, ...json };
    storageDispatch(storage);
});

function captureEvaluate(hostname, filename, fileSize) {
    return !(aria2Match['capture_domains'](hostname)
        || aria2Match['capture_extensions'](filename)
        || aria2Match['capture_filesize'](fileSize));
}

function getHostname(url) {
    let host = url.split('/')[2];
    if (host.includes('@')) {
        host = host.substring(host.indexOf('@') + 1);
    }
    if (host.includes(':')) {
        host = host.substring(0, host.indexOf(':'));
    }
    return host;
}

function toolbarCounter() {
    let number = aria2Active.size;
    chrome.action.setBadgeText({ text: !number ? '' : String(number) });
}

function openPopupWindow(url, winSize) {
    chrome.windows.getCurrent(({ top, left, height, width }) => {
        top = (top + height - winSize) / 2 | 0;
        left = (left + width - 710) / 2 | 0;
        height = winSize;
        width = 698;
        chrome.tabs.query({ url }, ([tab]) => {
            console.log(tab);
            if (tab) {
                chrome.windows.update(tab.windowId, { focused: true, left, width, top, height });
                chrome.tabs.update(tab.tabId, { url, active: true });
            } else {
                chrome.windows.create({ url, type: 'popup', left, width, top, height });
            }
        });
    });
}
