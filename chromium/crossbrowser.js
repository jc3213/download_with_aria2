var aria2Default = {
    'jsonrpc_scheme': 'http',
    'jsonrpc_url': 'localhost:6800/jsonrpc',
    'jsonrpc_secret': '',
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
    'capture_include': [],
    'capture_exclude': [],
    'capture_type_include': [],
    'capture_type_exclude': [],
    'capture_size_include': 0,
    'capture_size_exclude': 0
};
var aria2RPC;
var aria2Retry;
var aria2Storage = {};
var aria2Updated = {};
var aria2Global = {};
var aria2Version;
var aria2Manifest = chrome.runtime.getManifest();
var aria2Active = 0;
var aria2Queue = {};
var aria2Inspect = {};
var aria2Headers = typeof browser !== 'undefined' ? ['requestHeaders'] : ['requestHeaders', 'extraHeaders'];

chrome.runtime.onInstalled.addListener(({reason, previousVersion}) => {
    if (reason === 'install') {
        chrome.storage.sync.set(aria2Default);
    }
    aria2WhenInstall(reason);
});

chrome.contextMenus.onClicked.addListener(async ({menuItemId, linkUrl, srcUrl}, {id, url}) => {
    switch (menuItemId) {
        case 'aria2c_this_url':
            aria2DownloadHandler(linkUrl, {}, url, getHostname(url), id);
            break;
        case 'aria2c_this_image':
            aria2DownloadHandler(srcUrl, {}, url, getHostname(url), id);
            break;
        case 'aria2c_all_images':
            aria2ImagesPrompt(id);
            break;
    }
});

async function aria2DownloadHandler(url, options, referer, hostname, tabId) {
    if (aria2Updated['proxy_include'].test(hostname)) {
        options['all-proxy'] = aria2Storage['proxy_server'];
    }
    if (!options['dir'] && aria2Storage['folder_enabled'] && aria2Storage['folder_defined']) {
        options['dir'] = aria2Storage['folder_defined'];
    }
    if (!aria2Updated['headers_exclude'].test(hostname)) {
        options['header'] = aria2SetHeaders(url, referer, tabId);
    }
    await aria2RPC.call({method: 'aria2.addUri', params: [[url], options]});
    await aria2WhenStart(url);
}

function aria2SetHeaders(url, referer, tabId) {
    tabId ??= Object.keys(aria2Inspect).find((id) => aria2Inspect[id][url]);
    var headers = aria2Inspect?.[tabId]?.[url] ?? [{name: 'User-Agent', value: navigator.userAgent}, {name: 'Referer', value: referer}];
    if (aria2Storage['headers_override']) {
        var ua = headers.findIndex(({name}) => name.toLowerCase() === 'user-agent');
        headers[ua].value = aria2Storage['headers_useragent'];
    }
    return headers.map((header) => header.name + ': ' + header.value);
}

function aria2DownloadPrompt() {
    getPopupWindow('/pages/newdld/newdld.html', 476);
}

async function aria2ImagesPrompt(tabId) {
    var popId = await getPopupWindow('/pages/images/images.html', 680);
    aria2Inspect[popId] = {images: aria2Inspect[tabId].images, filter: aria2Headers};
}

chrome.webNavigation.onBeforeNavigate.addListener(({tabId, url, frameId}) => {
    if (frameId === 0) {
        aria2Inspect[tabId] = {images: [], url};
    }
});

chrome.webNavigation.onHistoryStateUpdated.addListener(({tabId, url, frameId}) => {
    if (aria2Inspect?.[tabId]?.url !== url) {
        aria2Inspect[tabId] = {images: [], url};
    }
});

chrome.webRequest.onBeforeSendHeaders.addListener(({tabId, url, type, requestHeaders}) => {
    var inspect = aria2Inspect[tabId] ??= {images: []};
    if (inspect[url]) {
        return;
    }
    if (type === 'image') {
        inspect.images.push({url, headers: requestHeaders});
    }
    inspect[url] = requestHeaders;
}, {urls: ['http://*/*', 'https://*/*']}, aria2Headers);

chrome.tabs.onRemoved.addListener((tabId) => {
    delete aria2Inspect[tabId];
});

chrome.commands.onCommand.addListener((command) => {
    switch (command) {
        case 'open_options':
            chrome.runtime.openOptionsPage();
            break;
        case 'open_new_download':
            aria2DownloadPrompt();
            break;
    }
});

chrome.action ??= chrome.browserAction;
chrome.action.onClicked.addListener((tab) => {
    var url = chrome.runtime.getURL('/pages/popup/popup.html');
    chrome.tabs.query({currentWindow: true}, (tabs) => {
        var popup = tabs.find((tab) => tab.url === url);
        popup ? chrome.tabs.update(popup.id, {active: true}) : chrome.tabs.create({url, active: true});
    });
});

chrome.runtime.onMessage.addListener(({action, params}, sender, response) => {
    switch (action) {
        case 'allimage_prompt':
        case 'options_plugins':
            aria2SendResponse(sender?.tab?.id, response);
            break;
        case 'options_onchange':
            aria2OptionsChanged(params);
            break;
        case 'jsonrpc_onchange':
            aria2RPCOptionsChanged(params);
            break;
        case 'jsonrpc_download':
            aria2MessageHandler(params);
            break;
        case 'jsonrpc_metadata':
            aria2MetadataHandler(params);
            break;
        case 'open_new_download':
            aria2DownloadPrompt();
            break;
    }
});

function aria2SendResponse(tabId, response) {
    response({
        storage: aria2Storage,
        jsonrpc: aria2Global,
        version: aria2Version,
        params: aria2Inspect[tabId]
    });
}

async function aria2MessageHandler(urls) {
    var message = '';
    var session = urls.map(({url, options = {}}) => {
        message += url + '\n';
        return { method: 'aria2.addUri', params: [ [url], options ] };
    });
    await aria2RPC.call(...session);
    await aria2WhenStart(message);
}

async function aria2MetadataHandler(files) {
    var message = '';
    var session = files.map(({name, metadata}) => {
        message += name + '\n';
        return metadata;
    });
    await aria2RPC.call(...session);
    await aria2WhenStart(message);
}

function aria2OptionsChanged({storage, changes}) {
    aria2UpdateStorage(storage);
    if (changes['jsonrpc_scheme']) {
        aria2RPC.scheme = aria2Storage['jsonrpc_scheme'];
    }
    if (changes['jsonrpc_secret']) {
        aria2RPC.secret = aria2Storage['jsonrpc_secret'];
    }
    if (changes['jsonrpc_url']) {
        aria2RPC.url = aria2Storage['jsonrpc_url'];
    }
    chrome.storage.sync.set(aria2Storage);
}

function aria2RPCOptionsChanged({jsonrpc}) {
    aria2Global = {...aria2Global, ...jsonrpc};
    aria2RPC.call({method: 'aria2.changeGlobalOption', params: [jsonrpc]});
}

function aria2UpdateStorage(json) {
    aria2Storage = json;
    aria2Updated['manager_interval'] = json['manager_interval'] * 1000;
    aria2Updated['headers_exclude'] = getMatchPattern(json['headers_exclude']);
    aria2Updated['proxy_include'] = getMatchPattern(json['proxy_include']);
    aria2Updated['capture_include'] = getMatchPattern(json['capture_include']);
    aria2Updated['capture_exclude'] = getMatchPattern(json['capture_exclude']);
    aria2Updated['capture_type_include'] = getMatchPattern(json['capture_type_include'], true);
    aria2Updated['capture_type_exclude'] = getMatchPattern(json['capture_type_exclude'], true);
    aria2Updated['capture_size_include'] = json['capture_size_include'] * 1048576;
    aria2Updated['capture_size_exclude'] = json['capture_size_exclude'] * 1048576;
    aria2CaptureSwitch();
    chrome.action.setPopup({popup: json['manager_newtab'] ? '' : '/pages/popup/popup.html?toolbar'});
    chrome.contextMenus.removeAll();
    if (!json['context_enabled']) {
        return;
    }
    if (json['context_cascade']) {
        var parentId = 'aria2c_contextmenu';
        getContextMenu(parentId, 'extension_name', ['link', 'image', 'page']);
    }
    if (json['context_thisurl']) {
        getContextMenu('aria2c_this_url', 'contextmenu_thisurl', ['link'], parentId);
    }
    if (json['context_thisimage']) {
        getContextMenu('aria2c_this_image', 'contextmenu_thisimage', ['image'], parentId);
    }
    if (json['context_allimages']) {
        getContextMenu('aria2c_all_images', 'contextmenu_allimages', ['page'], parentId);
    }
}

chrome.storage.sync.get(null, (json) => {
    aria2UpdateStorage({...aria2Default, ...json});
    aria2RPC = new Aria2(aria2Storage['jsonrpc_scheme'], aria2Storage['jsonrpc_url'], aria2Storage['jsonrpc_secret']);
    aria2RPC.retry = 0;
    aria2RPC.onmessage = aria2WebSocket;
    aria2RPC.onclose = aria2ClientWorker;
    aria2ClientWorker();
});

async function aria2WebSocket({method, params}) {
    var gid = params[0].gid;
    switch (method) {
        case 'aria2.onDownloadStart':
            if (!aria2Queue[gid]) {
                aria2Active ++;
                aria2Queue[gid] = gid;
            }
            break;
        case 'aria2.onBtDownloadComplete':
            break;
        case 'aria2.onDownloadComplete':
            aria2WhenComplete(gid);
        default:
            delete aria2Queue[gid];
            aria2Active --;
    }
    aria2ToolbarBadge(aria2Active);
}

function aria2ClientWorker() {
    clearTimeout(aria2Retry);
    aria2RPC.call(
        {method: 'aria2.getGlobalOption'},
        {method: 'aria2.getVersion'},
        {method: 'aria2.tellActive'}
    ).then(([global, version, active]) => {
        chrome.action.setBadgeBackgroundColor({color: '#3cc'});
        aria2RPCOptionsSetup(global.result, version.result);
        aria2Active = active.result.length;
        active.result.forEach(({gid}) => aria2Queue[gid] = gid);
        aria2ToolbarBadge(aria2Active);
    }).catch((error) => {
        chrome.action.setBadgeBackgroundColor({color: '#c33'});
        aria2ToolbarBadge('E');
        aria2Retry = setTimeout(aria2ClientWorker, aria2Updated['manager_interval']);
    });
}

function aria2RPCOptionsSetup(json, version) {
    json['disk-cache'] = getFileSize(json['disk-cache']);
    json['min-split-size'] = getFileSize(json['min-split-size']);
    json['max-download-limit'] = getFileSize(json['max-download-limit']);
    json['max-upload-limit'] = getFileSize(json['max-upload-limit']);
    json['max-overall-download-limit'] = getFileSize(json['max-overall-download-limit']);
    json['max-overall-upload-limit'] = getFileSize(json['max-overall-upload-limit']);
    aria2Global = json;
    aria2Version = version.version;
}

function aria2ToolbarBadge(number) {
    chrome.action.setBadgeText({text: !number ? '' : number + ''});
}

function aria2CaptureResult(hostname, filename, filesize) {
    if (aria2Updated['capture_exclude'].test(hostname) ||
        aria2Updated['capture_type_exclude'].test(filename) ||
        aria2Updated['capture_size_exclude'] > 0 && filesize <= aria2Updated['capture_size_exclude']) {
        return false;
    }
    if (aria2Updated['capture_include'].test(hostname) ||
        aria2Updated['capture_type_include'].test(filename) ||
        aria2Updated['capture_size_include'] > 0 && filesize >= aria2Updated['capture_size_include']) {
        return true;
    }
    return false;
}

function aria2WhenInstall(reason) {
    if (aria2Storage['notify_install']) {
        var title = chrome.i18n.getMessage('extension_' + reason);
        var message = chrome.i18n.getMessage('extension_version').replace('{version}', aria2Manifest.version);
        return getNotification(title, message);
    }
}

function aria2WhenStart(message) {
    if (aria2Storage['notify_start']) {
        var title = chrome.i18n.getMessage('download_start');
        return getNotification(title, message);
    }
}

async function aria2WhenComplete(gid) {
    if (aria2Storage['notify_complete']) {
        var response = await aria2RPC.call({method: 'aria2.tellStatus', params: [gid]});
        var {bittorrent, files: [{path, uris}]} = response[0].result;
        var name = bittorrent?.info?.name || path?.slice(path.lastIndexOf('/') + 1) || uris[0]?.uri || gid;
        var title = chrome.i18n.getMessage('download_complete');
        return getNotification(title, name);
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

function getContextMenu(id, i18n, contexts, parentId) {
    chrome.contextMenus.create({id, title: chrome.i18n.getMessage(i18n), contexts, documentUrlPatterns: ['http://*/*', 'https://*/*'], parentId});
}

function getMatchPattern(pattern, filetype) {
    var regfix = filetype ? '\\.' : '^';
    return pattern.length === 0 ? /!/ : new RegExp(regfix + '(' + pattern.join('|').replace(/\./g, '\\.').replace(/\\?\.?\*\\?\.?/g, '.*') + ')$');
}

function getHostname(url) {
    var temp = url.slice(url.indexOf(':') + 3);
    var host = temp.slice(0, temp.indexOf('/'));
    return host.slice(host.indexOf('@') + 1);
}

function getNotification(title, message) {
    return new Promise((resolve) => {
        chrome.notifications.create({
            title, message,
            type: 'basic',
            iconUrl: '/icons/48.png'
        }, resolve);
    });
}

function getPopupWindow(url, offsetHeight) {
    return new Promise(async resolve => {
        chrome.windows.getCurrent(({width, height, left, top}) => {
            top += (height - offsetHeight) / 2 | 0;
            left += (width - 710) / 2 | 0;
            chrome.windows.create({
                url, left, top,
                type: 'popup',
                width: 698,
                height: offsetHeight
            }, (popup) => resolve(popup.tabs[0].id));
        });
    });
}
