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
var aria2Firefox = typeof browser !== 'undefined';
var aria2Headers = aria2Firefox ? ['requestHeaders'] : ['requestHeaders', 'extraHeaders'];
var aria2WebRequest = {
    'content-disposition': true,
    'content-type': true,
    'content-length': true
};

chrome.downloads.onDeterminingFilename ??= chrome.downloads.onCreated;
chrome.action ??= chrome.browserAction;

chrome.runtime.onInstalled.addListener(({reason, previousVersion}) => {
    if (reason === 'install') {
        chrome.storage.sync.set(aria2Default);
    }
    aria2WhenInstall(reason);
    if (reason === 'update' && previousVersion <= '4.10.1.2728') {
        chrome.storage.sync.remove(['headers_enabled', 'download_prompt', 'proxy_always']);
    }
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
    var headers = aria2Inspect[tabId] ? aria2Inspect[tabId][url] : [{name: 'User-Agent', value: navigator.userAgent}, {name: 'Referer', value: referer}];
    if (aria2Storage['headers_override']) {
        var ua = headers.findIndex(({name}) => name.toLowerCase() === 'user-agent');
        headers[ua].value = aria2Storage['headers_useragent'];
    }
    return headers.map((header) => header.name + ': ' + header.value);
}

function aria2DownloadPrompt() {
    getPopupWindow('/pages/newdld/newdld.html', 482);
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
    if (aria2Inspect[tabId] && aria2Inspect[tabId].url !== url) {
        aria2Inspect[tabId] = {images: [], url};
    }
});

chrome.webRequest.onBeforeSendHeaders.addListener(({tabId, url, type, requestHeaders}) => {
    var inspect = aria2Inspect[tabId];
    if (!inspect || inspect[url]) {
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
        case 'message_download':
            aria2MessageHandler(params);
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

async function aria2MessageHandler({urls, torrents, metalinks}) {
    var message = '';
    var session = [];
    urls?.forEach(({url, options = {}}) => {
        message += url + '\n';
        session.push({method: 'aria2.addUri', params: [[url], options]});
    });
    torrents?.forEach(({name, body, options = {}}) => {
        message += name + '\n';
        session.push({method: 'aria2.addTorrent', params: [body, [], options]});
    });
    metalinks?.map(({name, body, options = {}}) => {
        message += name + '\n';
        session.push({method: 'aria2.addMetalink', params: [body, options]});
    });
    await aria2RPC.call(...session);
    await aria2WhenStart(message);
}

chrome.storage.sync.get(null, (json) => {
    aria2UpdateStorage({...aria2Default, ...json});
    aria2RPC = new Aria2(aria2Storage['jsonrpc_scheme'], aria2Storage['jsonrpc_url'], aria2Storage['jsonrpc_secret']);
    aria2RPC.onmessage = aria2WebSocket;
    aria2RPC.onclose = aria2ClientWorker;
    aria2ClientWorker();
});

function aria2OptionsChanged({storage, changes}) {
    aria2UpdateStorage(storage);
    aria2UpdateJsonrpc(changes);
    chrome.storage.sync.set(aria2Storage);
}

async function aria2UpdateJsonrpc(changes) {
    if (changes['jsonrpc_scheme']) {
        aria2RPC.scheme = aria2Storage['jsonrpc_scheme'];
    }
    if (changes['jsonrpc_secret']) {
        aria2RPC.secret = aria2Storage['jsonrpc_secret'];
    }
    if (changes['jsonrpc_url']) {
        aria2RPC.url = aria2Storage['jsonrpc_url'];
    }
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
    if (aria2Storage['capture_enabled']) {
        if (aria2Manifest.manifest_version === 2) {
            if (aria2Storage['capture_webrequest']) {
                chrome.webRequest.onHeadersReceived.addListener(aria2CaptureWebRequest, {urls: ['<all_urls>'], types: ['main_frame', 'sub_frame']}, ['blocking', 'responseHeaders']);
                chrome.downloads.onDeterminingFilename.removeListener(aria2CaptureDownloads);
            }
            else {
                chrome.webRequest.onHeadersReceived.removeListener(aria2CaptureWebRequest);
                chrome.downloads.onDeterminingFilename.addListener(aria2CaptureDownloads);
            }
        }
        else {
            chrome.downloads.onDeterminingFilename.addListener(aria2CaptureDownloads);
        }
    }
    else {
        if (aria2Manifest.manifest_version === 2) {
            chrome.webRequest.onHeadersReceived.removeListener(aria2CaptureWebRequest);
        }
        chrome.downloads.onDeterminingFilename.removeListener(aria2CaptureDownloads);
    }
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

function aria2CaptureDownloads({id, url, finalUrl, referrer, filename, fileSize}) {
    finalUrl ??= url;
    if (finalUrl.startsWith('data') || finalUrl.startsWith('blob')) {
        return;
    }
    var hostname = referrer ? getHostname(referrer) : getHostname(finalUrl);
    var captured = aria2CaptureResult(hostname, filename, fileSize);
    if (captured) {
        chrome.downloads.cancel(id, async () => {
            chrome.downloads.erase({id});
            options = await getDownloadOptions(filename);
            aria2DownloadHandler(finalUrl, options, referrer, hostname); 
        });
    }
}

function aria2CaptureWebRequest({statusCode, url, initiator, originUrl, responseHeaders, tabId}) {
    if (statusCode !== 200) {
        return;
    }
    var result = {};
    responseHeaders.forEach(({name, value}) => {
        name = name.toLowerCase();
        if (aria2WebRequest[name]) {
            result[name] = value;
        }
    });
    if (!result['content-type']?.startsWith('application')) {
        return;
    }
    var disposition = result['content-disposition'];
    if (disposition?.startsWith('attachment')) {
        var out = decodeFileName(disposition);
    }
    initiator ??= originUrl;
    var hostname = getHostname(initiator);
    if (aria2CaptureResult(hostname, out, result['content-length'] | 0)) {
        aria2DownloadHandler(url, {out}, initiator, hostname, tabId);
        return {cancel: true};
    }
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

function aria2RPCOptionsChanged({jsonrpc}) {
    aria2Global = {...aria2Global, ...jsonrpc};
    aria2RPC.call({method: 'aria2.changeGlobalOption', params: [jsonrpc]});
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

async function aria2WebSocket({method, params}) {
    if (!method) {
        return;
    }
    var [{gid}] = params;
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
        var message = chrome.i18n.getMessage('extension_version').replace('{ver}', aria2Manifest.version);
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

async function getDownloadOptions(filename) {
    if (!aria2Firefox) {
        return {out: filename};
    }
    var {os} = await browser.runtime.getPlatformInfo();
    var idx = os === 'win' ? filename.lastIndexOf('\\') : filename.lastIndexOf('/');
    var out = filename.slice(idx + 1);
    if (aria2Storage['folder_enabled']) {
        if (aria2Storage['folder_firefox']) {
            return {out, dir: filename.slice(0, idx + 1)};
        }
        if (aria2Storage['folder_defined']) {
            return {out, dir: aria2Storage['folder_defined']};
        }
    }
    return {out, dir: null};
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

function decodeFileName(disposition) {
    var RFC2047 = disposition.match(/filename="?(=\?[^;]+\?=)/);
    if (RFC2047) {
        return decodeRFC2047(RFC2047[1]);
    }
    var RFC5987 = disposition.match(/filename\*="?([^;]+''[^";]+)/i);
    if (RFC5987) {
        return decodeRFC5987(RFC5987[1]);
    }
    var match = disposition.match(/filename="?([^";]+);?/);
    if (match) {
        return decodeNonASCII(match.pop());
    }
    return '';
}

function decodeISO8859(text) {
    var decode = [];
    var code = document.characterSet ?? 'UTF-8';
    [...text].forEach(s => {
        var c = s.charCodeAt(0);
        if (c < 256) {
            decode.push(c);
        }
    });
    return new TextDecoder(code).decode(Uint8Array.from(decode));
}

function decodeRFC5987(text) {
    var [string, utf8, code, data] = text.match(/(?:(utf-?8)|([^']+))''([^']+)/i);
    if (utf8) {
        return decodeNonASCII(data);
    }
    var decode = [];
    data.match(/%[0-9a-fA-F]{2}|./g)?.forEach(s => {
        var c = s.length === 3 ? parseInt(s.slice(1), 16) : s.charCodeAt(0);
        if (c < 256) {
            decode.push(c);
        }
    });
    return new TextDecoder(code).decode(Uint8Array.from(decode));
}

function decodeRFC2047(text) {
    var result = '';
    text.match(/[^\s]+/g).forEach(s => {
        var [string, code, b, q, data] = s.match(/=\?([^\?]+)\?(?:(b)|(q))\?([^\?]+)\?=/i);
        if (b) {
            var decode = [...atob(data)].map(s => s.charCodeAt(0));
        }
        if (q) {
            decode = data.match(/=[0-9a-fA-F]{2}|./g)?.map(v => {
                if (v === '_') {
                    return 0x20;
                }
                if (v.length === 3) {
                    return parseInt(v.slice(1), 16)
                }
                return v.charCodeAt(0);
            });
        }
        if (decode) {
            result += new TextDecoder(code).decode(Uint8Array.from(decode));
        }
    });
    return result;
}

function decodeNonASCII(text) {
    try {
        return /[^\u0000-\u007f]/.test(text) ? decodeISO8859(text) : decodeURI(text);
    }
    catch {
        return '';
    }
}
