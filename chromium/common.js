var aria2Prompt = {};
var aria2Monitor = {};

chrome.runtime.onMessage.addListener((message, sender, response) => {
    var {id} = sender.tab;
    response(aria2Prompt[id]);
});

chrome.commands.onCommand.addListener(command => {
    if (command === 'change_options') {
        chrome.runtime.openOptionsPage();
    }
    else if (command === 'open_new_download') {
        aria2NewSession('full');
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
    if (aria2Store['download_prompt']) {
        getDownloadPrompt(url, options);
    }
    else {
        aria2RPC.message('aria2.addUri', [[url], options]).then(result => aria2WhenStart(url));
    }
}

async function getDownloadPrompt(url, options) {
    var {tabs} = await aria2NewSession('slim');
    var {id} = tabs[0];
    aria2Prompt[id] = {url, options};
}

async function getDefaultOptions() {
    var response = await fetch('/options.json');
    var json = await response.json();
    chrome.storage.local.set(json);
    return json;
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
    if (aria2Store['capture_exclude'].find(host => hostname.endsWith(host))) {
        return 0;
    }
    else if (aria2Store['capture_always']) {
        return 2;
    }
    else if (aria2Store['capture_include'].find(host => hostname.endsWith(host))) {
        return 2;
    }
    return 1;
}

function getCaptureFileData(size, ext) {
    if (aria2Store['capture_reject'].includes(ext)) {
        return -3;
    }
    else if (aria2Store['capture_resolve'].includes(ext)) {
        return 2;
    }
    else if (aria2Store['capture_filesize'] > 0 && size >= aria2Store['capture_filesize']) {
        return 2;
    }
    return 0;
}

function getProxyServer(hostname) {
    if (aria2Store['proxy_enabled']) {
        if (aria2Store['proxy_always']) {
            return aria2Store['proxy_server'];
        }
        else if (aria2Store['proxy_include'].find(host => hostname.endsWith(host))) {
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

function hotfix() {
    if (aria2Store['capture_mode'] === undefined) {
        return;
    }
    if (aria2Store['capture_mode'] === '0') {
        aria2Store['capture_enabled'] = false;
        aria2Store['capture_always'] = false;
        delete aria2Store['capture_mode'];
    }
    else if (aria2Store['capture_mode'] === '1') {
        aria2Store['capture_enabled'] = true;
        aria2Store['capture_always'] = false;
        delete aria2Store['capture_mode'];
    }
    else if (aria2Store['capture_mode'] === '2') {
        aria2Store['capture_enabled'] = true;
        aria2Store['capture_always'] = true;
        delete aria2Store['capture_mode'];
    }
    if (aria2Store['download_headers'] === '1') {
        aria2Store['download_headers'] = true;
    }
    else {
        aria2Store['download_headers'] = false;
    }
    if (aria2Store['download_prompt'] === '1') {
        aria2Store['download_prompt'] = true;
    }
    else {
        aria2Store['download_prompt'] = false;
    }
    if (aria2Store['notify_start'] === '1') {
        aria2Store['notify_start'] = true;
    }
    else {
        aria2Store['notify_start'] = false;
    }
    if (aria2Store['notify_complete'] === '1') {
        aria2Store['notify_complete'] = true;
    }
    else {
        aria2Store['notify_complete'] = false;
    }
    if (aria2Store['proxy_mode'] === '0') {
        aria2Store['proxy_enabled'] = false;
        aria2Store['proxy_always'] = false;
        delete aria2Store['proxy_mode'];
    }
    else if (aria2Store['proxy_mode'] === '1') {
        aria2Store['proxy_enabled'] = true;
        aria2Store['proxy_always'] = false;
        delete aria2Store['proxy_mode'];
    }
    else if (aria2Store['proxy_mode'] === '2') {
        aria2Store['proxy_enabled'] = true;
        aria2Store['proxy_always'] = true;
        delete aria2Store['proxy_mode'];
    }
    if (aria2Store['capture_size'] !== undefined) {
        aria2Store['capture_filesize'] = aria2Store['capture_size'];
        delete aria2Store['capture_size'];
    }
    if (aria2Store['folder_mode'] === '0') {
        aria2Store['folder_enabled'] = false;
        aria2Store['folder_firefox'] = false;
        delete aria2Store['folder_mode'];
    }
    else if (aria2Store['folder_mode'] === '1') {
        aria2Store['folder_enabled'] = true;
        aria2Store['folder_firefox'] = false;
        delete aria2Store['folder_mode'];
    }
    else if (aria2Store['folder_mode'] === '2') {
        aria2Store['folder_enabled'] = true;
        aria2Store['folder_firefox'] = true;
        delete aria2Store['folder_mode'];
    }
    if (aria2Store['folder_path'] !== undefined) {
        aria2Store['folder_defined'] = aria2Store['folder_path'];
        delete aria2Store['folder_path'];
    }
    if (aria2Store['capture_api'] === '1') {
        aria2Store['capture_webrequest'] = true;
    }
    else {
        aria2Store['capture_webrequest'] = false;
    }
    chrome.storage.local.set(aria2Store);
}
