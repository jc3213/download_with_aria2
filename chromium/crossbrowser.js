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
var aria2RPC;
var aria2Popup = '/pages/popup/popup.html';
var aria2InTab = `${chrome.runtime.id}/pages/popup/popup.html`;
var aria2Images = '/pages/images/images.html';
var aria2Monitor = {};
var aria2Prompt = {};
var aria2Message = {};

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
        return;
    }
    Object.keys(changes).forEach((key) => {
        var {newValue} = changes[key];
        if (newValue !== undefined) {
            aria2Store[key] = newValue;
        }
    });
    if ('context_enabled' in changes || 'context_cascade' in changes || 'context_thisurl' in changes || 'context_thisimage' in changes || 'context_allimages' in changes) {
        aria2ContextMenus();
    }
    aria2Update(changes);
});

chrome.runtime.onInstalled.addListener(({reason, previousVersion}) => {
    if (reason === 'install') {
        chrome.storage.sync.set(aria2Default);
    }
    else if (reason === 'update' && previousVersion <= '4.5.2.2208') {
        chrome.storage.local.get(null, (json) => {
            aria2Store = {...aria2Store, ...json};
            chrome.storage.sync.set(json);
            chrome.storage.local.clear();
        });
    }
});

chrome.runtime.onMessage.addListener(({action, params}, {tab}, response) => {
    var {id} = tab;
    if (action === 'internal_prompt') {
        response(aria2Prompt[id]);
    }
    else if (action === 'internal_images') {
        response(aria2Message[id]);
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
    options['all-proxy'] = getProxyServer(hostname);
    options['dir'] = getDownloadFolder();
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

function aria2ContextMenus(params = {}) {
    chrome.contextMenus.removeAll();
    if (!aria2Store['context_enabled']) {
        return;
    }
    if (aria2Store['context_cascade']) {
        chrome.contextMenus.create({id: 'aria2c_contextmenu', title: chrome.i18n.getMessage('extension_name'), contexts: ['link', 'image', 'page']});
        params.parentId = 'aria2c_contextmenu';
    }
    if (aria2Store['context_thisurl']) {
        chrome.contextMenus.create({...params, id: 'aria2c_this_url', title: chrome.i18n.getMessage('contextmenu_thisurl'), contexts: ['link']});
    }
    if (aria2Store['context_thisimage']) {
        chrome.contextMenus.create({...params, id: 'aria2c_this_image', title: chrome.i18n.getMessage('contextmenu_thisimage'), contexts: ['image']});
    }
    if (aria2Store['context_allimages']) {
        chrome.contextMenus.create({...params, id: 'aria2c_all_images', title: chrome.i18n.getMessage('contextmenu_allimages'), contexts: ['page']});
    }
}

function getCurrentTabUrl() {
    return new Promise((resolve) => {
        chrome.tabs.query({active: true, currentWindow: true}, tabs => {
            var {url} = tabs[0];
            resolve(url);
        });
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

function getProxyServer(hostname) {
    if (aria2Store['proxy_enabled'] || aria2Store['proxy_include'].some(host => hostname.includes(host))) {
        return aria2Store['proxy_server'];
    }
    return null;
}

function getRequestHeaders(url) {
    return new Promise((resolve) => {
        chrome.cookies.getAll({url}, (cookies) => {
            var header = 'Cookie:';
            cookies.forEach((cookie) => {
                var {name, value} = cookie;
                header += ` ${name}=${value};`;
            });
            resolve([header]);
        });
    });
}

function getDownloadFolder() {
    if (aria2Store['folder_enabled'] && aria2Store['folder_defined'] !== '') {
        return aria2Store['folder_defined'];
    }
    return null;
}
