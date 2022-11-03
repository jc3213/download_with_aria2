var aria2Panel = {};

chrome.runtime.onMessage.addListener((message, sender, response) => {
    var {id} = sender.tab;
    response(aria2Panel[id]);
});

async function getDownloadPrompt(url, options) {
    var {id} = await aria2NewSession('background', 380);
    aria2Panel[id] = {url, options};
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

function getCaptureFilter(hostname, type, size) {
    if (aria2Store['capture_exclude'].find(host => hostname.endsWith(host))) {
        return false;
    }
    else if (aria2Store['capture_reject'].includes(type)) {
        return false;
    }
    else if (aria2Store['capture_mode'] === '2') {
        return true;
    }
    else if (aria2Store['capture_include'].find(host => hostname.endsWith(host))) {
        return true;
    }
    else if (aria2Store['capture_resolve'].includes(type)) {
        return true;
    }
    else if (aria2Store['capture_size'] > 0 && size >= aria2Store['capture_size']) {
        return true;
    }
    else {
        return false;
    }
}

function getProxyServer(hostname) {
    if (aria2Store['proxy_mode'] === '1' && aria2Store['proxy_include'].find(host => hostname.endsWith(host))) {
        return aria2Store['proxy_server'];
    }
    else if (aria2Store['proxy_mode'] === '2') {
        return aria2Store['proxy_server'];
    }
    else {
        return null;
    }
}

function getCookies(url) {
    return new Promise(resolve => {
        var result = 'Cookie:';
        chrome.cookies.getAll({url}, cookies => {
            cookies.forEach(cookie => {
                var {name, value} = cookie;
                result += ' ' + name + '=' + value + ';';
            });
            resolve(result);
        });
    });
}

function getDownloadFolder() {
    if (aria2Store['folder_mode'] === '1' && aria2Store['folder_path']) {
        return aria2Store['folder_path'];
    }
    else {
        return null;
    }
}
