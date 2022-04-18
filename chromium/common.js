function aria2StartUp() {
    aria2Worker = startWorker('background', ({text, color}) => {
        text = text === 0 ? '' : text + '';
        chrome.browserAction.setBadgeText({text});
        chrome.browserAction.setBadgeBackgroundColor({color});
    });
    aria2Update();
    aria2Capture();
}

function aria2Update() {
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
    aria2Worker.postMessage({jsonrpc: aria2Store['jsonrpc_uri'], secret: aria2Store['secret_token']});
}

function getHostname(url) {
    try {
        return new URL(url).hostname;
    }
    catch {
        return 'about:blank';
    }
}

function getFileExtension(filename) {
    return filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
}

function getCaptureFilter(hostname, type, size) {
    return aria2Store['capture_exclude'].find(host => hostname.endsWith(host)) ? false :
        aria2Store['capture_reject'].includes(type) ? false :
        aria2Store['capture_mode'] === '2' ? true :
        aria2Store['capture_include'].find(host => hostname.endsWith(host)) ? true :
        aria2Store['capture_resolve'].includes(type) ? true :
        aria2Store['capture_size'] > 0 && size >= aria2Store['capture_size'] ? true : false;
}
