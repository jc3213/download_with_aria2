function aria2StartUp() {
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
    aria2RPC.message('aria2.tellActive').then(result => {
        var active = result.map(({gid}) => gid);
        var number = active.length;
        chrome.browserAction.setBadgeText({text: number === 0 ? '' : number + ''});
        chrome.browserAction.setBadgeBackgroundColor({color: '#3cc'});
        aria2Socket = new WebSocket(aria2Store['jsonrpc_uri'].replace('http', 'ws'));
        aria2Socket.onmessage = event => {
            var {method, params: [{gid}]} = JSON.parse(event.data);
            if (method === 'aria2.onDownloadStart') {
                if (active.indexOf(gid) === -1) {
                    active.push(gid);
                    number ++;
                }
            }
            else if (method !== 'aria2.onBtDownloadComplete'){
                active.splice(active.indexOf(gid), 1);
                number --;
            }
            chrome.browserAction.setBadgeText({text: number === 0 ? '' : number + ''});
        };
    }).catch(error => {
        chrome.browserAction.setBadgeText({text: 'E'});
        chrome.browserAction.setBadgeBackgroundColor({color: '#c33'});
    });
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
