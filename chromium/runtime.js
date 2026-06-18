const addonManager = chrome.runtime.getURL('/pages/popup/popup.html');
const addonImages = chrome.runtime.getURL('/pages/images/images.html');
const addonDownload = chrome.runtime.getURL('/pages/newdld/newdld.html');
const systemManifest = chrome.runtime.getManifest();
const systemFirefox = systemManifest.browser_specific_settings;
const systemHeaders = systemFirefox ? ['requestHeaders'] : ['requestHeaders', 'extraHeaders'];
const systemURLs = ['http://*/*', 'https://*/*'];
const systemStorage = {
    'jsonrpc_url': 'ws://localhost:6800/jsonrpc',
    'jsonrpc_secret': '',
    'jsonrpc_retries': -1,
    'jsonrpc_timeout': 10,
    'manager_newtab': false,
    'manager_interval': 10,
    'manager_filters': [],
    'ctxmenu_enabled': true,
    'ctxmenu_cascade': true,
    'ctxmenu_thisurl': true,
    'ctxmenu_thisimage': true,
    'ctxmenu_allimages': true,
    'notify_start': false,
    'notify_complete': false,
    'headers_override': false,
    'headers_useragent': 'Transmission/4.0.0',
    'headers_hosts': [],
    'folder_defined': '',
    'folder_enabled': false,
    'folder_firefox': false,
    'proxy_server': '',
    'proxy_hosts': [],
    'capture_enabled': false,
    'capture_webrequest': false,
    'capture_hosts': []
};

let aria2Storage = {};
let aria2Config = {};
let aria2Version;
let aria2Active = new Set();
let aria2Inspect = new Map();

let captureHosts;
let proxyHosts;
let headersHosts;

async function downloadNotify(type, gid) {
    if (!aria2Storage['notify_' + type]) {
        return;
    }

    let response = await aria2RPC.call('aria2.tellStatus', [gid]);
    let result = response.result;
    let bittorrent = result.bittorrent;
    let file = result.files[0];
    let path = file.path;
    let uris = file.uris;
    let title = chrome.i18n.getMessage('download_' + type);
    let message = bittorrent?.info?.name || path?.substring(path.lastIndexOf('/') + 1) || uris[0]?.uri || gid;

    chrome.notifications.create({ title, message, type: 'basic', iconUrl: '/icons/48.png' });
}

function downloadHeaders(tabId, url, referer) {
    let result = [];
    let headers;
    let inspect = aria2Inspect.get(tabId);

    if (inspect) {
        headers = inspect[url];
    }

    if (!headers) {
        for (let tab of aria2Inspect.values()) {
            let value = tab[url];
            if (value) {
                headers = value;
            }
        }
    }

    if (!headers) {
        headers = [{ name: 'Referer', value: referer }];
    }

    let oldUA = navigator.userAgent;

    for (let i = 0, l = headers.length; i < l; i++) {
        let header = headers[i];
        let name = header.name;
        let value = header.value;

        if (name.length === 10 && name.toLowerCase() === 'user-agent') {
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

    if (!hostname) {
        hostname = getHostname(referer);
    }

    if (matchHostname(proxyHosts, hostname)) {
        options['all-proxy'] = aria2Storage['proxy_server'];
    }

    if (!matchHostname(headersHosts, hostname)) {
        options['header'] = downloadHeaders(tabId, url, referer);
    }

    aria2RPC.call('aria2.addUri', [[url], options]);
}

function getHostname(url) {
    let start = url.indexOf('//') + 2;
    let end = url.indexOf('/', start);
    let host = url.substring(start, end);
    let at = host.indexOf('@');

    if (at !== -1) {
        host = host.substring(at + 1);
    }

    let colon = host.indexOf(':');

    if (colon !== -1) {
        host = host.substring(0, colon);
    }

    return host;
}

function matchHostname(rules, host) {
    if (rules.size === 0) {
        return false;
    }

    if (rules.has('*')) {
        return true;
    }

    for (;;) {
        if (rules.has(host)) {
            return true;
        }
        let dot = host.indexOf('.');
        if (dot === -1) {
            return false;
        }
        host = host.substring(dot + 1);
    }
}

function openPopupWindow(url, height) {
    chrome.windows.getCurrent((window) => {
        let top = (window.top + window.height - height) / 2 | 0;
        let left = (window.left + window.width - 710) / 2 | 0;
        let width = 698;

        chrome.tabs.query({ url }, (tabs) => {
            let tab = tabs[0];
            if (tab) {
                chrome.windows.update(tab.windowId, { focused: true, left, width, top, height });
                chrome.tabs.update(tab.id, { url, active: true });
            } else {
                chrome.windows.create({ url, type: 'popup', left, width, top, height });
            }
        });
    });
}

const jsonrpcRaw = [
    'dir',
    'file-allocation',
    'allow-overwrite',
    'max-concurrent-downloads',
    'max-tries',
    'retry-wait',
    'split',
    'max-connection-per-server',
    'user-agent',
    'listen-port',
    'bt-max-peers',
    'enable-dht',
    'enable-dht6',
    'follow-torrent',
    'bt-remove-unselected-file',
    'seed-ratio',
    'seed-time'
];

const jsonrpcSize = [
    'disk-cache',
    'min-split-size',
    'max-overall-download-limit',
    'max-overall-upload-limit'
];

const aria2RPC = new Aria2();

aria2RPC.onopen = () => {
    aria2RPC.multicall([
        { methodName: 'aria2.tellActive' },
        { methodName: 'aria2.getGlobalOption' },
        { methodName: 'aria2.getVersion' }
    ]).then((response) => {
        let result = response.result;
        let active = result[0][0];
        let options = result[1][0];
        aria2Version = result[2][0];

        for (let i = 0, l = jsonrpcRaw.length; i < l; i++) {
            let key = jsonrpcRaw[i];
            aria2Config[key] = options[key];
        }

        for (let i = 0, l = jsonrpcSize.length; i < l; i++) {
            let key = jsonrpcSize[i];
            aria2Config[key] = jsonrpcConvert(options[key]);
        }

        for (let i = 0, l = active.length; i < l; i++) {
            aria2Active.add(active[i].gid);
        }

        captureHooking();
        jsonrpcActivity();
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

aria2RPC.onmessage = (message) => {
    let method = message.method;

    if (method === 'aria2.onBtDownloadComplete') {
        return;
    }

    let gid = message.params[0].gid;

    if (method === 'aria2.onDownloadStart') {
        if (!aria2Active.has(gid)) {
            aria2Active.add(gid);
            downloadNotify('start', gid);
        }
    } else {
        aria2Active.delete(gid);

        if (method === 'aria2.onDownloadComplete') {
            downloadNotify('complete', gid);
        }
    }

    jsonrpcActivity();
};

function jsonrpcActivity() {
    let number = aria2Active.size;
    chrome.action.setBadgeText({ text: !number ? '' : `${number}` });
}

function jsonrpcConvert(bytes) {
    if (bytes < 1024) {
        return bytes;
    }

    if (bytes < 1048576) {
        return (bytes / 10.24 | 0) / 100 + 'K';
    }

    return (bytes / 10485.76 | 0) / 100 + 'M';
}

function jsonrpcDispatch(json) {
    for (let i = 0, l = jsonrpcRaw.length; i < l; i++) {
        let key = jsonrpcRaw[i];
        aria2Config[key] = json[key];
    }
    for (let i = 0, l = jsonrpcSize.length; i < l; i++) {
        let key = jsonrpcSize[i];
        aria2Config[key] = json[key];
    }
}

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId === 0) {
        aria2Inspect.set(details.tabId, { images: [], url: details.url });
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    let url = changeInfo.url;

    if (!url) {
        return;
    }

    let inspect = aria2Inspect.get(tabId);

    if (!inspect || inspect.url !== url) {
        aria2Inspect.set(tabId, { images: [], url });
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    aria2Inspect.delete(tabId);
});

chrome.webRequest.onBeforeSendHeaders.addListener((details) => {
    let tabId = details.tabId;
    let url = details.url;
    let tab = aria2Inspect.get(tabId);

    if (!tab) {
        tab = { images: [], url };
        aria2Inspect.set(tabId, tab);
    }

    if (details.type === 'image') {
        let idx = url.search(/[?#@]/);
        let img = idx === -1 ? url : url.substring(0, idx);

        if (img in tab) {
            return;
        }

        tab[img] = url;
        tab.images.push(url);
    } else {
        tab[url] = details.requestHeaders;
    }
}, { urls: systemURLs, types: ['main_frame', 'sub_frame', 'image', 'other'] }, systemHeaders);

chrome.action.onClicked.addListener(() => {
    chrome.tabs.query({ url: addonManager, currentWindow: true }, (tabs) => {
        let tab = tabs[0];
        if (tab) {
            chrome.tabs.update(tab.id, { active: true });
        } else {
            chrome.tabs.create({ url: addonManager, active: true });
        }
    });
});

chrome.commands.onCommand.addListener((command) => {
    if (command === 'open_options') {
        chrome.runtime.openOptionsPage();
        return;
    }

    if (command === 'open_new_download') {
        openPopupWindow(addonDownload, 454);
        return;
    }

    if (command === 'toggle_capture') {
        commandToggleHost('capture_hosts', captureHosts);
        return;
    }

    if (command === 'toggle_headers') {
        commandToggleHost('headers_hosts', headersHosts);
        return;
    }

    if (command === 'toggle_proxy') {
        commandToggleHost('proxy_hosts', proxyHosts);
        return;
    }
});

function commandToggleHost(id, rules) {
    chrome.tabs.query({ url: systemURLs, active: true, currentWindow: true }, (tabs) => {
        let tab = tabs[0];

        if (!tab) {
            return;
        }

        let host = getHostname(tab.url);
        let options;

        if (rules.has(host)) {
            rules.delete(host);
            options = 'match_remove';
        } else {
            rules.add(host);
            options = 'match_add';
        }

        let title = chrome.i18n.getMessage('options_' + id.substring(0, id.indexOf('_')));
        let message = chrome.i18n.getMessage(options, [host, chrome.i18n.getMessage(id)]);
        let value = Array.from(rules);
        aria2Storage[id] = value;

        chrome.storage.sync.set({ [id]: value });
        chrome.runtime.sendMessage({ options, params: { id, host } }, () => chrome.runtime.lastError);
        chrome.notifications.create({ title, message, type: 'basic', iconUrl: '/icons/48.png' });
    });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
    let id = info.menuItemId;

    if (id === 'ctxmenu_thisurl') {
        downloadHandler(info.linkUrl, tab.url, null, null, tab.id);
        return;
    }

    if (id === 'ctxmenu_thisimage') {
        downloadHandler(info.srcUrl, tab.url, null, null, tab.id);
        return;
    }

    if (id === 'ctxmenu_allimages') {
        openPopupWindow(addonImages + '?' + tab.id, 680);
        return;
    }
});

function contextMenusEnabler(json) {
    chrome.contextMenus.removeAll();

    if (!json['ctxmenu_enabled']) {
        return;
    }

    let menuId;

    if (json['ctxmenu_cascade']) {
        menuId = 'extension_name';
        contextMenusAdd(menuId, ['link', 'image', 'page']);
    }

    if (json['ctxmenu_thisurl']) {
        contextMenusAdd('ctxmenu_thisurl', ['link'], menuId);
    }

    if (json['ctxmenu_thisimage']) {
        contextMenusAdd('ctxmenu_thisimage', ['image'], menuId);
    }

    if (json['ctxmenu_allimages']) {
        contextMenusAdd('ctxmenu_allimages', ['page'], menuId);
    }
}

function contextMenusAdd(id, contexts, parentId) {
    chrome.contextMenus.create({
        id,
        title: chrome.i18n.getMessage(id),
        contexts,
        parentId,
        documentUrlPatterns: ['http://*/*', 'https://*/*']
    });
}

function popupMenuEnabler(json) {
    if (json['manager_newtab']) {
        chrome.action.setPopup({ popup: '' });
    } else {
        chrome.action.setPopup({ popup: '/pages/popup/popup.html?toolbar' });
    }
}

chrome.runtime.onMessage.addListener((message, sender, response) => {
    let action = message.action;

    if (!action) {
        return;
    }

    let params = message.params;

    if (action === 'options_runtime') {
        response({ system: systemManifest, storage: aria2Storage });
        return;
    }

    if (action === 'options_jsonrpc') {
        response({ options: aria2Config, version: aria2Version });
        return;
    }

    if (action === 'update_storage') {
        storageDispatch(params);
        chrome.storage.sync.set(params, response);
        return true;
    }

    if (action === 'update_jsonrpc') {
        jsonrpcDispatch(params);
        aria2RPC.call('aria2.changeGlobalOption', [params]).then(response).catch(response);
        return true;
    }

    if (action === 'popup_runtime') {
        response({ storage: aria2Storage, options: aria2Config, version: aria2Version });
        return;
    }

    if (action === 'popup_queues') {
        aria2Storage['manager_filters'] = params;
        chrome.storage.sync.set({ 'manager_filters': params }, response);
        return true;
    }

    if (action === 'images_runtime') {
        let images = aria2Inspect.get(params)?.images || [];
        response({ system: systemManifest, headers: systemHeaders, images, storage: aria2Storage, options: aria2Config });
        return true;
    }

    if (action === 'newdld_window') {
        openPopupWindow(addonDownload, 454);
        return;
    }

    if (action === 'newdld_runtime') {
        response({ storage: aria2Storage, options: aria2Config });
        return;
    }

    if (action === 'remote_status') {
        response({ system: systemManifest, options: aria2Config });
        return;
    }

    if (action === 'remote_download') {
        aria2RPC.multicall(params).then(response).catch(response);
        return true;
    }
});

chrome.storage.sync.get(null, (json) => {
    let storage = { ...systemStorage, ...json };
    storageDispatch(storage);
});

function storageDispatch(json) {
    aria2Storage = json;
    aria2RPC.url = json['jsonrpc_url'];
    aria2RPC.secret = json['jsonrpc_secret'];
    aria2RPC.retries = json['jsonrpc_retries'];
    aria2RPC.timeout = json['jsonrpc_timeout'];
    aria2RPC.connect();
    headersHosts = new Set(json['headers_hosts']);
    proxyHosts = new Set(json['proxy_hosts']);
    captureHosts = new Set(json['capture_hosts']);
    popupMenuEnabler(json);
    contextMenusEnabler(json);
}
