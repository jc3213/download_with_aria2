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

function getFileSize(bytes) {
    return isNaN(bytes) ? '??' : bytes < 1024 ? bytes + ' B' :
        bytes < 1048576 ? (bytes / 10.24 | 0) / 100 + ' KB' :
        bytes < 1073741824 ? (bytes / 10485.76 | 0) / 100 + ' MB' :
        bytes < 1099511627776 ? (bytes / 10737418.24 | 0) / 100 + ' GB' : (bytes / 10995116277.76 | 0) / 100 + ' TB';
}

function promiseFileReader(file, method = 'readAsText') {
    return new Promise(resolve => {
        var reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader[method](file);
    });
}

function aria2Indicator() {
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

function aria2Terminate() {
    self.aria2Socket && aria2Socket.readyState === 1 && aria2Socket.close();
    self.aria2Alive && clearInterval(aria2Alive);
}

function showNotification(message = '') {
    chrome.notifications.create({
        type: 'basic',
        title: aria2Store['jsonrpc_uri'],
        iconUrl: '/icons/icon48.png',
        message
    });
}
