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
    'download_prompt': false,
    'notify_install': true,
    'notify_start': false,
    'notify_complete': false,
    'user_agent': 'Transmission/4.0.0',
    'headers_enabled': false,
    'headers_exclude': [],
    'folder_enabled': false,
    'folder_defined': '',
    'folder_firefox': false,
    'proxy_server': '',
    'proxy_include': [],
    'proxy_enabled': false,
    'capture_enabled': false,
    'capture_always': false,
    'capture_webrequest': false,
    'capture_filesize': 0,
    'capture_resolve': [],
    'capture_include': [],
    'capture_reject': [],
    'capture_exclude': []
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
var aria2Matches = [
    'headers_exclude',
    'proxy_include',
    'capture_include',
    'capture_exclude'
];
var aria2Multiplier = {
    'manager_interval': 1000,
    'capture_filesize': 1048576
};
var aria2MultiKeys = [
    'manager_interval',
    'capture_filesize'
];
var aria2SizeKeys = [
    'min-split-size',
    'disk-cache',
    'max-download-limit',
    'max-overall-download-limit',
    'max-upload-limit',
    'max-overall-upload-limit',
];
var aria2Start = chrome.i18n.getMessage('download_start');
var aria2Complete = chrome.i18n.getMessage('download_complete');
var aria2NewDL = '/pages/newdld/newdld.html';
var aria2Popup = chrome.runtime.getURL('/pages/popup/popup.html');
var aria2Images = '/pages/images/images.html';
var aria2Message = {};

chrome.runtime.onInstalled.addListener(({reason, previousVersion}) => {
    if (reason === 'install') {
        chrome.storage.sync.set(aria2Default);
    }
    aria2WhenInstall(reason);
});

chrome.contextMenus.onClicked.addListener(async ({menuItemId, linkUrl, srcUrl}, {id, url, cookieStoreId}) => {
    switch (menuItemId) {
        case 'aria2c_this_url':
            aria2DownloadPrompt(linkUrl, {}, url, getHostname(url), cookieStoreId);
            break;
        case 'aria2c_this_image':
            aria2DownloadPrompt(srcUrl, {}, url, getHostname(url), cookieStoreId);
            break;
        case 'aria2c_all_images':
            aria2ImagesPrompt(id, url, cookieStoreId);
            break;
    }
});

async function aria2DownloadPrompt(url, options, referer, hostname, storeId) {
    options['user-agent'] = aria2Storage['user_agent'];
    if (aria2Storage['proxy_enabled'] || aria2Updated['proxy_include'].test(hostname)) {
        options['all-proxy'] = aria2Storage['proxy_server'];
    }
    if (!options['dir'] && aria2Storage['folder_enabled'] && aria2Storage['folder_defined']) {
        options['dir'] = aria2Storage['folder_defined'];
    }
    if (aria2Storage['headers_enabled'] && !aria2Updated['headers_exclude'].test(hostname)) {
        options['referer'] = referer;
        options['header'] = await aria2SetCookies(url, storeId);
    }
    if (aria2Storage['download_prompt']) {
        var popId = await aria2PopupWindow(aria2NewDL + '?slim_mode', 319);
        aria2Message[popId] = {url, options};
        return;
    }
    await aria2RPC.call({method: 'aria2.addUri', params: [[url], options]});
    await aria2WhenStart(url);
}

async function aria2ImagesPrompt(tabId, referer, storeId) {
    var result = await aria2ScriptExecutor(tabId, getImagesOnThisPage);
    var header = await aria2SetCookies(referer, storeId);
    var popId = await aria2PopupWindow(aria2Images, 680);
    aria2Message[popId] = {result, options: {referer, header}};
}

async function aria2SetCookies(url, storeId) {
    var result = 'Cookie:';
    var cookies = await getRequestCookies(url, storeId);
    cookies.forEach(({name, value}) => result += ' ' + name + '=' + value + ';');
    return [result];
}

function aria2ScriptExecutor(tabId, func) {
    if (aria2Manifest.manifest_version === 3) {
        return chrome.scripting.executeScript({target : {tabId}, func}).then((injectionResults) => injectionResults[0].result);
    }
    return new Promise((resolve, reject) => chrome.tabs.executeScript(tabId, {code: '(' + func.toString() + ')();'}, (results) => results ? resolve(results[0]) : reject(chrome.runtime.lastError)));
}

chrome.commands.onCommand.addListener((command) => {
    switch (command) {
        case 'open_options':
            chrome.runtime.openOptionsPage();
            break;
        case 'open_new_download':
            aria2PopupWindow(aria2NewDL, 532);
            break;
    }
});

chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.query({currentWindow: true}, (tabs) => {
        var popup = tabs.find((tab) => tab.url === aria2Popup);
        if (popup) {
            return chrome.tabs.update(popup.id, {active: true});
        }
        chrome.tabs.create({active: true, url: aria2Popup});
    });
});

chrome.runtime.onMessage.addListener(({action, params}, sender, response) => {
    switch (action) {
        case 'download_prompt':
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
            aria2DownloadHandler(params);
            break;
        case 'open_new_download':
            aria2PopupWindow(aria2NewDL, 532);
            break;
    }
});

function aria2SendResponse(tabId, response) {
    response({
        storage: aria2Storage,
        jsonrpc: aria2Global,
        version: aria2Version,
        params: aria2Message[tabId]
    });
}

async function aria2DownloadHandler({urls, files}) {
    var message = '';
    if (urls) {
        var session = urls.map(({url, options = {}}) => {
            message += url + '\n';
            return {method: 'aria2.addUri', params: [[url], options]};
        });
    }
    if (files?.torrents) {
        session = file.torrents.map(({name, body}) => {
            message += name + '\n';
            return {method: 'aria2.addTorrent', params: [body]};
        });
    }
    if (files?.metalinks) {
        session = file.metalinks.map(({name, body, options = {}}) => {
            message += name + '\n';
            return {method: 'aria2.addMetalink', params: [body, options]};
        });
    }
    await aria2RPC.call(...session);
    await aria2WhenStart(message);
}

function aria2OptionsChanged({storage, changes}) {
    chrome.storage.sync.set(storage);
    aria2Storage = storage;
    aria2UpdateJSONRPC(changes);
    aria2UpdateStorage();
    aria2ContextMenus();
    aria2TaskManager();
    if (aria2Manifest.manifest_version === 2) {
        aria2CaptureSwitch();
    }
}

async function aria2UpdateJSONRPC(changes) {
    if (changes['jsonrpc_url']) {
        await aria2RPC.disconnect();
        return aria2ClientSetUp();
    }
    if (changes['jsonrpc_scheme']) {
        aria2RPC.scheme = aria2Storage['jsonrpc_scheme'];
    }
    if (changes['jsonrpc_secret']) {
        aria2RPC.secret = aria2Storage['jsonrpc_secret'];
    }
}

function aria2UpdateStorage() {
    aria2Matches.forEach((key) => {
        var array = aria2Storage[key];
        aria2Updated[key] = array.length === 0 ? /!/ : new RegExp('^(' + array.join('|').replace(/\./g, '\\.').replace(/\\?\.?\*\\?\.?/g, '.*') + ')$');
    });
    aria2MultiKeys.forEach((key) => {
        aria2Updated[key] = aria2Storage[key] * aria2Multiplier[key];
    });
}

function aria2ContextMenus() {
    chrome.contextMenus.removeAll();
    if (!aria2Storage['context_enabled']) {
        return;
    }
    if (aria2Storage['context_cascade']) {
        var parentId = 'aria2c_contextmenu';
        getContextMenu('aria2c_contextmenu', 'extension_name', ['link', 'image', 'page']);
    }
    if (aria2Storage['context_thisurl']) {
        getContextMenu('aria2c_this_url', 'contextmenu_thisurl', ['link'], parentId);
    }
    if (aria2Storage['context_thisimage']) {
        getContextMenu('aria2c_this_image', 'contextmenu_thisimage', ['image'], parentId);
    }
    if (aria2Storage['context_allimages']) {
        getContextMenu('aria2c_all_images', 'contextmenu_allimages', ['page'], parentId);
    }
}

function aria2TaskManager() {
    var popup = aria2Storage['manager_newtab'] ? '' : aria2Popup + '?as_popup';
    chrome.action.setPopup({popup});
}

function aria2RPCOptionsSetUp(jsonrpc) {
    aria2SizeKeys.forEach((key) => {
        jsonrpc[key] = getFileSize(jsonrpc[key]);
    });
    return jsonrpc;
}

function aria2RPCOptionsChanged({jsonrpc}) {
    aria2Global = {...aria2Global, ...jsonrpc};
    aria2RPC.call({method: 'aria2.changeGlobalOption', params: [jsonrpc]});
}

async function aria2ClientSetUp() {
    clearTimeout(aria2Retry);
    aria2RPC = new Aria2(aria2Storage['jsonrpc_scheme'], aria2Storage['jsonrpc_url'], aria2Storage['jsonrpc_secret']);
    aria2RPC.call(
        {method: 'aria2.getGlobalOption'},
        {method: 'aria2.getVersion'},
        {method: 'aria2.tellActive'}
    ).then(([global, version, active]) => {
        chrome.action.setBadgeBackgroundColor({color: '#3cc'});
        aria2Global = aria2RPCOptionsSetUp(global.result);
        aria2Version = version.result.version;
        aria2Active = active.result.length;
        active.result.forEach(({gid}) => aria2Queue[gid] = gid);
        aria2ToolbarBadge(aria2Active);
        aria2RPC.onmessage = aria2WebSocket;
    }).catch((error) => {
        chrome.action.setBadgeBackgroundColor({color: '#c33'});
        aria2ToolbarBadge('E');
        aria2Retry = setTimeout(aria2ClientSetUp, aria2Updated['manager_interval']);
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
            var [session] = await aria2RPC.call({method: 'aria2.tellStatus', params: [gid]});
            var name = getSessionName(gid, session.result.bittorrent, session.result.files);
            aria2WhenComplete(name);
        default:
            delete aria2Queue[gid];
            aria2Active --;
    }
    aria2ToolbarBadge(aria2Active);
}

function aria2ToolbarBadge(number) {
    chrome.action.setBadgeText({text: !number ? '' : number + ''});
}

function aria2CaptureResult(hostname, fileext, size) {
    if (aria2Updated['capture_exclude'].test(hostname) ||
        aria2Storage['capture_reject'].includes(fileext)) {
        return false;
    }
    if (aria2Storage['capture_always'] ||
        aria2Updated['capture_include'].test(hostname) ||
        aria2Storage['capture_resolve'].includes(fileext) ||
        aria2Updated['capture_filesize'] > 0 && size >= aria2Updated['capture_filesize']) {
        return true;
    }
    return false;
}

function aria2PopupWindow(url, offsetHeight) {
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

function aria2WhenInstall(reason) {
    if (aria2Storage['notify_install']) {
        var title = chrome.i18n.getMessage('extension_' + reason);
        var message = chrome.i18n.getMessage('extension_version').replace('{ver}', aria2Manifest.version);
        return getNotification(title, message);
    }
}

function aria2WhenStart(message) {
    if (aria2Storage['notify_start']) {
        return getNotification(aria2Start, message);
    }
}

function aria2WhenComplete(message) {
    if (aria2Storage['notify_complete']) {
        return getNotification(aria2Complete, message);
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

function getRequestCookies(url, storeId) {
    if (storeId) {
        return browser.cookies.getAll({url, storeId, firstPartyDomain: null});
    }
    return new Promise((resolve) => chrome.cookies.getAll({url}, resolve));
}

function getSessionName(gid, bittorrent, [{path, uris}]) {
    return bittorrent?.info?.name || path?.slice(path.lastIndexOf('/') + 1) || uris[0]?.uri || gid;
}

function getHostname(url) {
    var temp = url.slice(url.indexOf('://') + 3);
    var host = temp.slice(0, temp.indexOf('/'));
    return host.slice(host.indexOf('@') + 1);
}

function getFileExtension(filename) {
    var fileext = filename.slice(filename.lastIndexOf('.') + 1);
    return fileext.toLowerCase();
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

function getImagesOnThisPage() {
    var result = [];
    var logs = {};
    getImagesInFrame(document);
    document.querySelectorAll('iframe').forEach((iframe) => {
        try {
            getImagesInFrame(iframe.contentDocument ?? iframe.contentWindow.document);
        } catch (error) {
            return;
        }
    });
    return result;

    function getImagesInFrame(doc) {
        doc?.querySelectorAll('img').forEach(({src, alt}) => {
            if (!src || src.startsWith('data') || logs[src]) {
                return;
            }
            logs[src] = true;
            result.push({src, alt});
        });
    }
}
