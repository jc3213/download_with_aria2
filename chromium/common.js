function aria2StartUp() {
    aria2Worker = startWorker('background');
    aria2Worker.onmessage = event => {
        var {text, color} = event.data;
        text = text === 0 ? '' : text + '';
        chrome.browserAction.setBadgeText({text});
        chrome.browserAction.setBadgeBackgroundColor({color});
    }
    aria2Update();
}

function aria2Update() {
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
    aria2Worker.postMessage({storage: [aria2Store['jsonrpc_uri'], aria2Store['secret_token']]});
}

function getDomainFromUrl(url) {
    try {
        var {hostname} = new URL(url);
    }
    catch {
        return;
    }
    if (hostname.startsWith('[')) {
        return hostname.slice(1, -1);
    }
    var tld = hostname.slice(hostname.lastIndexOf('.') + 1);
    if (hostname.indexOf('.') === hostname.lastIndexOf('.') || !isNaN(tld)) {
        return hostname;
    }
    var sld = hostname.slice(hostname.slice(0, - tld.length - 1).lastIndexOf('.') + 1, - tld.length - 1);
    var sub = hostname.slice(hostname.slice(0, - tld.length - sld.length - 2).lastIndexOf('.') + 1, - tld.length - sld.length - 2);
    return ['com', 'net', 'org', 'edu', 'gov', 'co', 'ne', 'or', 'me'].includes(sld) ? sub + '.' + sld + '.' + tld : sld + '.' + tld;
}

function getFileExtension(filename) {
    return filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
}

function captureDownload(domain, type, size) {
    return aria2Store['capture_exclude'].includes(domain) ? false :
        aria2Store['capture_reject'].includes(type) ? false :
        aria2Store['capture_mode'] === '2' ? true :
        aria2Store['capture_include'].includes(domain) ? true :
        aria2Store['capture_resolve'].includes(type) ? true :
        aria2Store['capture_size'] > 0 && size >= aria2Store['capture_size'] ? true : false;
}
