var aria2Default = {
    'jsonrpc_scheme': 'http',
    'jsonrpc_host': 'localhost:6800',
    'jsonrpc_secret': '',
    'context_enabled': true,
    'context_cascade': true,
    'context_thisurl': true,
    'context_thisimage': true,
    'context_allimages': true,
    'manager_newtab': false,
    'manager_interval': 10000,
    'folder_enabled': false,
    'folder_defined': '',
    'folder_firefox': false,
    'download_prompt': false,
    'headers_enabled': false,
    'headers_exclude': [],
    'notify_start': false,
    'notify_complete': false,
    'user_agent': 'Transmission/4.0.0',
    'proxy_enabled': false,
    'proxy_server': '',
    'proxy_include': [],
    'capture_enabled': false,
    'capture_always': false,
    'capture_webrequest': false,
    'capture_filesize': 0,
    'capture_resolve': [],
    'capture_include': [],
    'capture_reject': [],
    'capture_exclude': []
};
var aria2Match = {};
var aria2MatchKeys = ['headers_exclude', 'proxy_include', 'capture_include', 'capture_exclude'];
var aria2Storage = {};
var aria2RPC;
var aria2Popup = '/pages/popup/popup.html';
var aria2InTab = chrome.runtime.getURL('/pages/popup/popup.html?open_in_tab');
var aria2Images = '/pages/images/images.html';
var aria2Monitor = {};
var aria2Message = {};

chrome.runtime.onInstalled.addListener(({reason, previousVersion}) => {
    if (reason === 'install') {
        chrome.storage.sync.set(aria2Default);
    }
    if (previousVersion <= '4.6.5.2366') {
        chrome.storage.sync.get(null, (json) => {
            var uri = json['jsonrpc_uri'];
            if (uri !== undefined) {
                var {protocol, host} = new URL(uri);
                var scheme = protocol.slice(0, -1);
                json['jsonrpc_scheme'] = scheme;
                json['jsonrpc_host'] = host;
                delete json['jsonrpc_uri'];
            }
            var secret = json['jsonrpc_token'];
            if (secret !== undefined) {
                json['jsonrpc_secret'] = secret;
                delete json['jsonrpc_token'];
            }
            aria2Storage = json;
            aria2RPC = new Aria2(scheme, host, secret);
            chrome.storage.sync.set(json);
            chrome.storage.sync.remove(['jsonrpc_uri', 'jsonrpc_token']);
        });
    }
});

chrome.runtime.onMessage.addListener(async ({action, params}, {tab}, response) => {
    switch (action) {
        case 'download_prompt':
            response(aria2Message[tab.id]);
            break;
        case 'allimage_prompt':
            response(aria2Message[tab.id]);
            break;
        case 'message_download':
            await aria2MV3Migration();
            aria2DownloadPrompt(params);
            break;
        case 'message_allimage':
            aria2ImagesPrompt(params);
            break;
        case 'options_onchange':
            aria2OptionsChanged(params);
            break;
    }
});

chrome.commands.onCommand.addListener((command) => {
    switch (command) {
        case 'open_options':
            chrome.runtime.openOptionsPage();
            break;
        case 'open_new_download':
            aria2NewDownload();
            break;
    }
});

chrome.contextMenus.onClicked.addListener(async ({menuItemId, linkUrl, srcUrl}, {id, url, cookieStoreId}) => {
    switch (menuItemId) {
        case 'aria2c_this_url':
            await aria2MV3Migration();
            aria2Download(linkUrl, {}, url, getHostname(url), cookieStoreId);
            break;
        case 'aria2c_this_image':
            await aria2MV3Migration();
            aria2Download(srcUrl, {}, url, getHostname(url), cookieStoreId);
            break;
        case 'aria2c_all_images':
            chrome.tabs.sendMessage(id, menuItemId);
            break;
    }
});

chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.query({currentWindow: true}, (tabs) => {
        var popup = tabs.find((tab) => tab.url === aria2InTab);
        if (popup) {
            return chrome.tabs.update(popup.id, {active: true});
        }
        chrome.tabs.create({active: true, url: aria2InTab});
    });
});

async function aria2Download(url, options, referer, hostname, storeId) {
    options['user-agent'] = aria2Storage['user_agent'];
    if (aria2Storage['proxy_enabled'] || aria2Match['proxy_include'].test(hostname)) {
        options['all-proxy'] = aria2Storage['proxy_server'];
    }
    if (options['dir'] === undefined && aria2Storage['folder_enabled'] && aria2Storage['folder_defined'] !== '') {
        options['dir'] = aria2Storage['folder_defined'];
    }
    if (aria2Storage['headers_enabled'] && !aria2Match['headers_exclude'].test(hostname)) {
        options['referer'] = referer;
        options['header'] = storeId ? await getRequestHeadersFirefox(url, storeId) : await getRequestHeaders(url);
    }
    aria2DownloadPrompt({url, options});
}

async function aria2DownloadPrompt(aria2c) {
    if (aria2Storage['download_prompt']) {
        var id = await aria2NewDownload(true);
        aria2Message[id] = aria2c;
        return;
    }
    var {url, json, options} = aria2c;
    if (json) {
        return aria2DownloadJSON(json, options);
    }
    if (url) {
        return aria2DownloadUrls(url, options);
    }
}

async function aria2ImagesPrompt(result) {
    var id = await getNewWindow(aria2Images, 680);
    aria2Message[id] = result;
}

function aria2OptionsChanged({storage, changes}) {
    aria2Storage = storage;
    aria2UpdateJSONRPC(changes);
    aria2ContextMenus();
    aria2TaskManager();
    aria2MatchPattern();
}

function aria2UpdateJSONRPC(changes) {
    if ('jsonrpc_host' in changes) {
        aria2RPC.disconnect();
        return aria2ClientSetUp();
    }
    if ('jsonrpc_scheme' in changes) {
        aria2RPC.method = aria2Storage['jsonrpc_scheme'];
    }
    if ('jsonrpc_secret' in changes) {
        aria2RPC.secret = 'token:' + aria2Storage['jsonrpc_secret'];
    }
}

function aria2ContextMenus() {
    chrome.contextMenus.removeAll();
    if (!aria2Storage['context_enabled']) {
        return;
    }
    if (aria2Storage['context_cascade']) {
        var parentId = 'aria2c_contextmenu';
        chrome.contextMenus.create({id: 'aria2c_contextmenu', title: chrome.i18n.getMessage('extension_name'), contexts: ['link', 'image', 'page']});
    }
    if (aria2Storage['context_thisurl']) {
        chrome.contextMenus.create({id: 'aria2c_this_url', title: chrome.i18n.getMessage('contextmenu_thisurl'), contexts: ['link'], parentId});
    }
    if (aria2Storage['context_thisimage']) {
        chrome.contextMenus.create({id: 'aria2c_this_image', title: chrome.i18n.getMessage('contextmenu_thisimage'), contexts: ['image'], parentId});
    }
    if (aria2Storage['context_allimages']) {
        chrome.contextMenus.create({ id: 'aria2c_all_images', title: chrome.i18n.getMessage('contextmenu_allimages'), contexts: ['page'], parentId});
    }
}

function aria2TaskManager() {
    var popup = aria2Storage['manager_newtab'] ? '' : aria2Popup;
    chrome.action.setPopup({popup});
}

function aria2MatchPattern() {
    aria2MatchKeys.forEach((key) => {
        var array = aria2Storage[key];
        aria2Match[key] = array.length === 0 ? /!/ : new RegExp('^(' + array.join('|').replace(/\./g, '\\.').replace(/\*/g, '.*') + ')$');
    });
}

async function aria2MV3Migration() {
    if (!aria2RPC) {
        aria2Storage = await chrome.storage.sync.get(null);
        aria2ClientSetUp();
        aria2MatchPattern();
    }
}

function getCurrentTabUrl() {
    return new Promise((resolve) => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => resolve(tabs[0].url));
    });
}

function getFileExtension(filename) {
    var fileext = filename.slice(filename.lastIndexOf('.') + 1);
    return fileext.toLowerCase();
}

function getCaptureGeneral(hostname, fileext, size) {
    if (aria2Match['capture_exclude'].test(hostname) ||
        aria2Storage['capture_reject'].includes(fileext)) {
        return false;
    }
    if (aria2Storage['capture_always'] ||
        aria2Match['capture_include'].test(hostname) ||
        aria2Storage['capture_resolve'].includes(fileext) ||
        aria2Storage['capture_size'] > 0 && size >= aria2Storage['capture_size']) {
        return true;
    }
    return false;
}

function getCaptureHostname(hostname) {
    if (aria2Match['capture_exclude'].test(hostname)) {
        return -1;
    }
    if (aria2Storage['capture_always'] ||
        aria2Match['capture_include'].test(hostname)) {
        return 1;
    }
    return 0;
}

function getCaptureFileData(size, fileext) {
    if (aria2Storage['capture_reject'].includes(fileext)) {
        return -1;
    }
    if (aria2Storage['capture_resolve'].includes(fileext) ||
        aria2Storage['capture_filesize'] > 0 && size >= aria2Storage['capture_filesize']) {
        return 1;
    }
    return 0;
}

function getRequestHeaders(url) {
    return new Promise((resolve) => {
        chrome.cookies.getAll({url}, (cookies) => {
            var header = 'Cookie:';
            cookies.forEach(({name, value}) => header += ' ' + name + '=' + value + ';');
            resolve([header]);
        });
    });
}
