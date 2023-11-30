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
var aria2Store = {};
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
            aria2Store[key] = newValue;
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

chrome.runtime.onMessage.addListener(({action, params}, {tab}, response) => {
    if (action === 'internal_prompt') {
        response(aria2Prompt[tab.id]);
    }
    else if (action === 'internal_images') {
        response(aria2Message[tab.id]);
    }
    else if (action === 'external_download') {
        aria2DownloadPrompt(params);
    }
    else if (action = 'external_images') {
        aria2ImagesPrompt(params);
    }
});

chrome.commands.onCommand.addListener((command) => {
    if (command === 'open_options') {
        chrome.runtime.openOptionsPage();
    }
    else if (command === 'open_new_download') {
        aria2NewDownload();
    }
});

async function aria2Download(url, referer, hostname, options = {}, storeId) {
    options['user-agent'] = aria2Store['user_agent'];
    if (aria2Store['proxy_enabled'] || aria2Store['proxy_include'].some(host => hostname.includes(host))) {
        options['all-proxy'] = aria2Store['proxy_server'];
    }
    if (options['dir'] === undefined && aria2Store['folder_enabled'] && aria2Store['folder_defined'] !== '') {
        options['dir'] = aria2Store['folder_defined'];
    }
    if (aria2Store['headers_enabled'] && !aria2Store['headers_exclude'].some(host => hostname.includes(host))) {
        options['referer'] = referer;
        options['header'] = storeId ? await getRequestHeadersFirefox(url, storeId) : await getRequestHeaders(url);
    }
    aria2DownloadPrompt({url, options});
}

async function aria2ImagesPrompt(result) {
    var id = await getNewWindow(aria2Images, 680);
    aria2Message[id] = result;
}

function aria2ContextMenus() {
    chrome.contextMenus.removeAll();
    if (!aria2Store['context_enabled']) {
        return;
    }
    if (aria2Store['context_cascade']) {
        var parentId = 'aria2c_contextmenu';
        chrome.contextMenus.create({id: 'aria2c_contextmenu', title: chrome.i18n.getMessage('extension_name'), contexts: ['link', 'image', 'page']});
    }
    if (aria2Store['context_thisurl']) {
        chrome.contextMenus.create({id: 'aria2c_this_url', title: chrome.i18n.getMessage('contextmenu_thisurl'), contexts: ['link'], parentId});
    }
    if (aria2Store['context_thisimage']) {
        chrome.contextMenus.create({id: 'aria2c_this_image', title: chrome.i18n.getMessage('contextmenu_thisimage'), contexts: ['image'], parentId});
    }
    if (aria2Store['context_allimages']) {
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
    if (aria2Store['capture_exclude'].some(host => hostname.includes(host))) {
        return false;
    }
    else if (aria2Store['capture_reject'].includes(fileext)) {
        return false;
    }
    else if (aria2Store['capture_always']) {
        return true;
    }
    else if (aria2Store['capture_include'].some(host => hostname.includes(host))) {
        return true;
    }
    else if (aria2Store['capture_resolve'].includes(fileext)) {
        return true;
    }
    else if (aria2Store['capture_size'] > 0 && size >= aria2Store['capture_size']) {
        return true;
    }
    return false;
}

function getCaptureHostname(hostname) {
    if (aria2Store['capture_exclude'].some(host => hostname.includes(host))) {
        return -1;
    }
    else if (aria2Store['capture_always']) {
        return 1;
    }
    else if (aria2Store['capture_include'].some(host => hostname.includes(host))) {
        return 1;
    }
    return 0;
}

function getCaptureFileData(size, fileext) {
    if (aria2Store['capture_reject'].includes(fileext)) {
        return -1;
    }
    else if (aria2Store['capture_resolve'].includes(fileext)) {
        return 1;
    }
    else if (aria2Store['capture_filesize'] > 0 && size >= aria2Store['capture_filesize']) {
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
