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
    'notify_install': true,
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
let aria2Version;
let aria2Storage = {};
let aria2Updated = {};
let aria2Config = {};
let aria2Active;
let aria2Manager = 0;
let aria2Popup = 0;
let aria2Tabs = new Set();
let aria2Inspect = {};
let aria2Detect = {};
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
        let headers = aria2Inspect[tabId]?.[url] ?? Object.values(aria2Inspect).find((tab) => tab[url])?.[url] ?? [{name: 'User-Agent', value: navigator.userAgent}, {name: 'Referer', value: referer}];
        if (aria2Storage['headers_override']) {
            let ua = headers.findIndex(({name}) => name.toLowerCase() === 'user-agent');
            headers[ua].value = aria2Storage['headers_useragent'];
        }
        options['header'] = headers.map((header) => header.name + ': ' + header.value);
    }
    await aria2RPC.call({method: 'aria2.addUri', params: [[url], options]});
    aria2WhenStart(url);
}

function aria2ImagesPrompt(referer, tabId) {
    aria2Detect = {referer, tabId};
    openPopupWindow('/pages/images/images.html', 680);
}

chrome.contextMenus.onClicked.addListener(({menuItemId, linkUrl, srcUrl}, {id, url}) => {
    switch (menuItemId) {
        case 'aria2c_this_url':
            aria2DownloadHandler(linkUrl, url, {}, id);
            break;
        case 'aria2c_this_image':
            aria2DownloadHandler(srcUrl, url, {}, id);
            break;
        case 'aria2c_all_images':
            aria2ImagesPrompt(url, id);
            break;
    };
});

function aria2DownloadPrompt() {
    openPopupWindow('/pages/newdld/newdld.html', 462);
}

chrome.commands.onCommand.addListener((command) => {
    switch (command) {
        case 'open_options':
            chrome.runtime.openOptionsPage();
            break;
        case 'open_new_download':
            aria2DownloadPrompt();
            break;
    };
});

function aria2SystemRuntime() {
    return {
        storage: aria2Storage,
        options: aria2Config,
        version: aria2Version.version,
        manifest: aria2Manifest
    };
}

function aria2StorageChanged(json) {
    aria2RPC.disconnect();
    aria2RPC.scheme = json['jsonrpc_scheme'];
    aria2RPC.url = json['jsonrpc_url'];
    aria2RPC.secret = json['jsonrpc_secret'];
    aria2StorageUpdate(json);
    chrome.storage.sync.set(aria2Storage);
}

function aria2ConfigChanged(options) {
    aria2Config = {...aria2Config, ...options};
    aria2RPC.call({method: 'aria2.changeGlobalOption', params: [options]});
}

function aria2DownloadUrls(urls) {
    let message = '';
    let session = urls.map(({url, options = {}}) => {
        message += url + '\n';
        return { method: 'aria2.addUri', params: [ [url], options ] };
    });
    aria2RPC.call(...session);
    aria2WhenStart(message);
}

async function aria2DownloadFiles(files) {
    let message = '';
    let session = files.map(({name, data}) => {
        message += name + '\n';
        return data;
    });
    aria2RPC.call(...session);
    aria2WhenStart(message);
}

function aria2DetectedImages(response) {
    let {tabId, referer} = aria2Detect;
    let tab = aria2Inspect[tabId];
    let json = aria2SystemRuntime();
    json.referer = referer;
    json.tabId = aria2Popup;
    json.images = tab ? [...tab.images.values()] : [];
    json.request = aria2Request;
    return json;
}

chrome.runtime.onMessage.addListener(({action, params}, sender, response) => {
    switch (action) {
        case 'system_runtime':
            response(aria2SystemRuntime());
            break;
        case 'storage_update':
            aria2StorageChanged(params);
            break;
        case 'jsonrpc_update':
            aria2ConfigChanged(params);
            break;
        case 'jsonrpc_download':
            aria2DownloadUrls(params);
            break;
        case 'jsonrpc_metadata':
            aria2DownloadFiles(params);
            break;
        case 'open_all_images':
            response(aria2DetectedImages());
            break;
        case 'open_new_download':
            aria2DownloadPrompt();
            break;
    };
});

chrome.tabs.onRemoved.addListener((tabId) => {
    delete aria2Inspect[tabId];
});

chrome.tabs.onUpdated.addListener((tabId, {status}, {url}) => {
    switch (status) {
        case 'loading':
            if (url.startsWith('http') && !aria2Tabs.has(tabId)) {
                aria2Tabs.add(tabId);
                aria2Inspect[tabId] = { images: new Map(), url };
            }
            break;
        case 'complete':
            aria2Tabs.delete(tabId);
            break;
    };
});

chrome.webRequest.onBeforeSendHeaders.addListener(({tabId, url, type, requestHeaders}) => {
    if (tabId === aria2Popup) {
        return;
    }
    let tab = aria2Inspect[tabId] ??= { images: new Map(), url };
    if (type === 'image') {
        let index = url.indexOf('?');
        let uri = index !== -1 ? url.slice(0, index) : url;
        tab.images.set(uri, url);
    } else {
        tab[url] = requestHeaders;
    }
}, { urls: [ 'http://*/*', 'https://*/*' ], types: [ 'main_frame', 'sub_frame', 'image', 'other' ] }, aria2Request);

chrome.action ??= chrome.browserAction;

chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.get(aria2Manager, (tab) => {
        let url = '/pages/popup/popup.html';
        if (!chrome.runtime.lastError && tab.url.endsWith(url)) {
            chrome.tabs.update(aria2Manager, { active: true });
        } else {
            chrome.tabs.create({ url, active: true }, (tab) => {
                aria2Manager = tab.id;
            });
        }
    });
});

chrome.runtime.onInstalled.addListener(({reason}) => {
    aria2WhenInstall(reason);
});

chrome.storage.sync.get(null, (json) => {
    let storage = {...aria2Default, ...json};
    aria2RPC = new Aria2(storage['jsonrpc_scheme'], storage['jsonrpc_url'], storage['jsonrpc_secret']);
    aria2RPC.onopen = aria2ClientOpened;
    aria2RPC.onclose = aria2ClientClosed;
    aria2RPC.onmessage = aria2ClientMessage;
    aria2StorageUpdate(storage);
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
    aria2CaptureSwitch();
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

async function aria2ClientOpened() {
    let [version, options, active] = await aria2RPC.call({method: 'aria2.getVersion'}, {method: 'aria2.getGlobalOption'}, {method: 'aria2.tellActive'});
    aria2Config = options.result;
    aria2Version = version.result;
    aria2Config['disk-cache'] = getFileSize(aria2Config['disk-cache']);
    aria2Config['min-split-size'] = getFileSize(aria2Config['min-split-size']);
    aria2Config['max-download-limit'] = getFileSize(aria2Config['max-download-limit']);
    aria2Config['max-upload-limit'] = getFileSize(aria2Config['max-upload-limit']);
    aria2Config['max-overall-download-limit'] = getFileSize(aria2Config['max-overall-download-limit']);
    aria2Config['max-overall-upload-limit'] = getFileSize(aria2Config['max-overall-upload-limit']);
    aria2Active = new Set(active.result.map(({ gid }) => gid));
    chrome.action.setBadgeBackgroundColor({color: '#1C4CD4'});
    setIndicator();
}

function aria2ClientClosed() {
    aria2Active = aria2Config = aria2Version = null;
    chrome.action.setBadgeBackgroundColor({color: '#D33A26'});
    chrome.action.setBadgeText({text: 'E'});
}

async function aria2ClientMessage({method, params}) {
    let {gid} = params[0];
    switch (method) {
        case 'aria2.onDownloadStart':
            aria2Active.add(gid);
            break;
        case 'aria2.onBtDownloadComplete':
            break;
        case 'aria2.onDownloadComplete':
            aria2WhenComplete(gid);
        default:
            aria2Active.delete(gid);
            break;
    };
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

function aria2WhenInstall(reason) {
    if (aria2Storage['notify_install']) {
        let title = chrome.i18n.getMessage('extension_' + reason);
        let message = chrome.i18n.getMessage('extension_version').replace('{version}', aria2Manifest.version);
        showNotification(title, message);
    }
}

function aria2WhenStart(message) {
    if (aria2Storage['notify_start']) {
        let title = chrome.i18n.getMessage('download_start');
        showNotification(title, message);
    }
}

async function aria2WhenComplete(gid) {
    if (aria2Storage['notify_complete']) {
        let response = await aria2RPC.call({method: 'aria2.tellStatus', params: [gid]});
        let {bittorrent, files: [{path}]} = response[0].result;
        let name = bittorrent?.info?.name ?? path?.slice(path.lastIndexOf('/') + 1);
        let title = chrome.i18n.getMessage('download_complete');
        showNotification(title, name);
    }
}

function getFileSize(bytes) {
    if (isNaN(bytes)) {
        return '??';
    }
    if (bytes < 1024) {
        return bytes;
    }
    if (bytes < 1048576) {
        return (bytes / 10.24 | 0) / 100 + 'K';
    }
    if (bytes < 1073741824) {
        return (bytes / 10485.76 | 0) / 100 + 'M';
    }
    if (bytes < 1099511627776) {
        return (bytes / 10737418.24 | 0) / 100 + 'G';
    }
    return (bytes / 10995116277.76 | 0) / 100 + 'T';
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
    chrome.action.setBadgeText({text: !number ? '' : String(number)});
}

function showNotification(title, message) {
    chrome.notifications.create({
        title,
        message,
        type: 'basic',
        iconUrl: '/icons/48.png'
    });
}

function openPopupWindow(url, height) {
    chrome.windows.getAll({windowTypes: ['normal']}, (windows) => {
        let window = windows[0];
        let where = {
            top: (window.top + window.height - height) / 2 | 0,
            left: (window.left + window.width - 710) / 2 | 0,
            height,
            width: 698
        };
        chrome.tabs.get(aria2Popup, (tab) => {
            if (chrome.runtime.lastError) {
                chrome.windows.create({ url, type: 'popup', ...where }, (popup) => {
                    aria2Popup = popup.tabs[0].id;
                });
            } else {
                chrome.windows.update(tab.windowId, { focused: true, ...where });
                chrome.tabs.update(aria2Popup, { url: tab.url.endsWith(url) ? null : url, active: true });
            }
        });
    });
}
