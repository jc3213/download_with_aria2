var aria2Prompt = {};
var aria2Monitor = {};

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
    if (command === 'change_options') {
        chrome.runtime.openOptionsPage();
    }
    else if (command === 'open_new_download') {
        getDownloadWindow('full');
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

async function aria2DownloadPrompt(message) {
    if (aria2Store['download_prompt']) {
        var {tabs} = await getDownloadWindow('slim');
        var {id} = tabs[0];
        aria2Prompt[id] = message;
    }
    else {
        var {url, json, options = {}} = message;
        if (json) {
            aria2DownloadUrls(json, options);
        }
        else if (url) {
            aria2DownloadJSON(url, options);
        }
    }
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
