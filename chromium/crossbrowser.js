var aria2Default = {
    'jsonrpc_uri': 'http://localhost:6800/jsonrpc',
    'jsonrpc_token': '',
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
    'notify_complete': true,
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
var aria2Storage = {};
var aria2Changes = [
    {
        keys: ['jsonrpc_uri', 'jsonrpc_token'],
        action: aria2ClientSetUp
    },
    {
        keys: ['context_enabled', 'context_cascade', 'context_thisurl', 'context_thisimage', 'context_allimages'],
        action: aria2ContextMenus
    },
    {
        keys: ['manager_newtab'],
        action: aria2TaskManager
    }
];
var aria2RPC;
var aria2Popup = '/pages/popup/popup.html';
var aria2InTab = `${chrome.runtime.id}/pages/popup/popup.html`;
var aria2Images = '/pages/images/images.html';
var aria2Monitor = {};
var aria2Prompt = {};
var aria2Message = {};

chrome.storage.onChanged.addListener((changes) => {
    Object.keys(changes).forEach((key) => {
        var {newValue} = changes[key];
        if (newValue !== undefined) {
            aria2Storage[key] = newValue;
        }
    });
    aria2Changes.forEach(({keys, action}) => {
        if (keys.some((key) => key in changes)) {
            action();
        }
    });
});

chrome.runtime.onInstalled.addListener(({reason, previousVersion}) => {
    if (reason === 'install') {
        chrome.storage.sync.set(aria2Default);
    }
});

chrome.contextMenus.onClicked.addListener(({menuItemId, linkUrl, srcUrl}, {id, url, cookieStoreId}) => {
    switch (menuItemId) {
        case 'aria2c_this_url':
            aria2Download(linkUrl, url, getHostname(url), {}, cookieStoreId);
            break;
        case 'aria2c_this_image':
            aria2Download(srcUrl, url, getHostname(url), {}, cookieStoreId);
            break;
        case 'aria2c_all_images':
            chrome.tabs.sendMessage(id, menuItemId);
            break;
    }
});

chrome.runtime.onMessage.addListener(({action, params}, {tab}, response) => {
    switch (action) {
        case 'internal_prompt':
            response(aria2Prompt[tab.id]);
            break;
        case 'internal_images':
            response(aria2Message[tab.id]);
            break;
        case 'external_download':
            aria2DownloadPrompt(params);
            break;
        case 'external_images':
            aria2ImagesPrompt(params);
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

chrome.action = chrome.action ?? chrome.browserAction;
chrome.action.onClicked.addListener(getTaskManager);

async function aria2Download(url, referer, hostname, options = {}, storeId) {
    await aria2MV3SetUp();
    options['user-agent'] = aria2Storage['user_agent'];
    if (aria2Storage['proxy_enabled'] || aria2Storage['proxy_include'].some(host => hostname.includes(host))) {
        options['all-proxy'] = aria2Storage['proxy_server'];
    }
    if (options['dir'] === undefined && aria2Storage['folder_enabled'] && aria2Storage['folder_defined'] !== '') {
        options['dir'] = aria2Storage['folder_defined'];
    }
    if (aria2Storage['headers_enabled'] && !aria2Storage['headers_exclude'].some(host => hostname.includes(host))) {
        options['referer'] = referer;
        options['header'] = storeId ? await getRequestHeadersFirefox(url, storeId) : await getRequestHeaders(url);
    }
    aria2DownloadPrompt({url, options});
}

async function aria2DownloadPrompt(aria2c) {
    await aria2MV3SetUp();
    if (aria2Storage['download_prompt']) {
        var id = await aria2NewDownload(true);
        aria2Prompt[id] = aria2c;
        return;
    }
    var {url, json, options} = aria2c;
    if (json) {
        aria2DownloadJSON(json, options);
    }
    if (url) {
        aria2DownloadUrls(url, options);
    }
}

async function aria2ImagesPrompt(result) {
    var id = await getNewWindow(aria2Images, 680);
    aria2Message[id] = result;
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
    if (aria2Storage['capture_exclude'].some(host => hostname.includes(host))) {
        return false;
    }
    if (aria2Storage['capture_reject'].includes(fileext)) {
        return false;
    }
    if (aria2Storage['capture_always']) {
        return true;
    }
    if (aria2Storage['capture_include'].some(host => hostname.includes(host))) {
        return true;
    }
    if (aria2Storage['capture_resolve'].includes(fileext)) {
        return true;
    }
    if (aria2Storage['capture_size'] > 0 && size >= aria2Storage['capture_size']) {
        return true;
    }
    return false;
}

function getCaptureHostname(hostname) {
    if (aria2Storage['capture_exclude'].some(host => hostname.includes(host))) {
        return -1;
    }
    if (aria2Storage['capture_always']) {
        return 1;
    }
    if (aria2Storage['capture_include'].some(host => hostname.includes(host))) {
        return 1;
    }
    return 0;
}

function getCaptureFileData(size, fileext) {
    if (aria2Storage['capture_reject'].includes(fileext)) {
        return -1;
    }
    if (aria2Storage['capture_resolve'].includes(fileext)) {
        return 1;
    }
    if (aria2Storage['capture_filesize'] > 0 && size >= aria2Storage['capture_filesize']) {
        return 1;
    }
    return 0;
}

function getRequestHeaders(url) {
    return new Promise((resolve) => {
        chrome.cookies.getAll({url}, (cookies) => {
            var header = 'Cookie:';
            cookies.forEach(({name, value}) => header += ` ${name}=${value};`);
            resolve([header]);
        });
    });
}

function getTaskManager() {
    chrome.tabs.query({currentWindow: true}, (tabs) => {
        var popup = tabs.find(tab => tab.url.includes(aria2InTab));
        if (popup) {
            return chrome.tabs.update(popup.id, {active: true});
        }
        chrome.tabs.create({active: true, url: `${aria2Popup}?open_in_tab`});
    });
}

function aria2TaskManager() {
    var popup = aria2Storage['manager_newtab'] ? '' : aria2Popup;
    chrome.action.setPopup({popup});
}

async function aria2MV3SetUp() {
    if (!aria2RPC) {
        aria2Storage = await chrome.storage.sync.get(null);
        aria2RPC = new Aria2(aria2Storage['jsonrpc_uri'], aria2Storage['jsonrpc_token']);
    }
}
