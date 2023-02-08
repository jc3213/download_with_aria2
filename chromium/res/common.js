var aria2Default = {
    'jsonrpc_uri': 'http://localhost:6800/jsonrpc',
    'jsonrpc_token': '',
    'manager_newtab': false,
    'manager_interval': 5000,
    'folder_enabled': false,
    'folder_defined': '',
    'download_prompt': false,
    'download_headers': true,
    'notify_start': false,
    'notify_complete': true,
    'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
    'proxy_server': '',
    'proxy_enabled': false,
    'proxy_always': false,
    'proxy_include': [],
    'capture_enabled': false,
    'capture_always': false,
    'capture_filesize': 0,
    'capture_resolve': [],
    'capture_include': [],
    'capture_reject': [],
    'capture_exclude': [],
    'folder_firefox': false,
    'capture_webrequest': false
};
var aria2Monitor = {};
var aria2Prompt = {};

chrome.runtime.onInstalled.addListener(details => {
    var {reason, previousVersion} = details;
    if (reason === 'install') {
        chrome.storage.local.set(aria2Default);
    }
});

chrome.storage.onChanged.addListener(changes => {
    Object.keys(changes).forEach(key => {
        var {newValue} = changes[key];
        if (newValue !== undefined) {
            aria2Store[key] = newValue;
        }
    });
    aria2Update(changes);
});

chrome.runtime.onMessage.addListener((message, sender, response) => {
    var {type, message} = message;
    if (type === 'prompt') {
        var {id} = sender.tab;
        response(aria2Prompt[id]);
    }
    else if (type === 'download') {
        aria2DownloadPrompt(message);
    }
});

chrome.commands.onCommand.addListener(command => {
    if (command === 'open_options') {
        chrome.runtime.openOptionsPage();
    }
    else if (command === 'open_new_download') {
        aria2NewDownload();
    }
});

async function aria2Download(url, referer, hostname, options = {}) {
    options['user-agent'] = aria2Store['user_agent'];
    options['all-proxy'] = getProxyServer(hostname);
    options['dir'] = getDownloadFolder();
    if (aria2Store['download_headers']) {
        options['referer'] = referer;
        options['header'] = await getRequestHeaders(url);
    }
    aria2DownloadPrompt({url, options});
}

async function aria2DownloadPrompt(aria2c) {
    if (aria2Store['download_prompt']) {
        var {tabs} = await aria2NewDownload(true);
        var {id} = tabs[0];
        aria2Prompt[id] = aria2c;
    }
    else {
        var {url, json, options} = aria2c;
        if (json) {
            aria2DownloadJSON(json, options);
        }
        else if (url) {
            aria2DownloadUrls(url, options);
        }
    }
}

function getCurrentTabUrl() {
    return new Promise(resolve => {
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

function getCaptureHostname(hostname) {
    if (aria2Store['capture_exclude'].find(host => hostname.includes(host))) {
        return -1;
    }
    else if (aria2Store['capture_always']) {
        return 1;
    }
    else if (aria2Store['capture_include'].find(host => hostname.includes(host))) {
        return 1;
    }
    return 0;
}

function getCaptureFileData(size, ext) {
    if (aria2Store['capture_reject'].includes(ext)) {
        return -1;
    }
    else if (aria2Store['capture_resolve'].includes(ext)) {
        return 1;
    }
    else if (aria2Store['capture_filesize'] > 0 && size >= aria2Store['capture_filesize']) {
        return 1;
    }
    return 0;
}

function getProxyServer(hostname) {
    if (aria2Store['proxy_enabled']) {
        if (aria2Store['proxy_always']) {
            return aria2Store['proxy_server'];
        }
        else if (aria2Store['proxy_include'].find(host => hostname.includes(host))) {
            return aria2Store['proxy_server'];
        }
    }
    return null;
}

function getRequestHeaders(url) {
    return new Promise(resolve => {
        chrome.cookies.getAll({url}, cookies => {
            var header = 'Cookie:';
            cookies.forEach(cookie => {
                var {name, value} = cookie;
                header += ' ' + name + '=' + value + ';';
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
