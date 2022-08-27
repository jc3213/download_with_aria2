function aria2StartUp() {
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
    aria2RPC.message('aria2.tellActive').then(result => {
        var active = result.map(({gid}) => gid);
        chrome.browserAction.setBadgeText({text: active.length === 0 ? '' : active.length + ''});
        chrome.browserAction.setBadgeBackgroundColor({color: '#3cc'});
        aria2Socket = new WebSocket(aria2Store['jsonrpc_uri'].replace('http', 'ws'));
        aria2Socket.onmessage = async event => {
            var {method, params: [{gid}]} = JSON.parse(event.data);
            if (method !== 'aria2.onBtDownloadComplete') {
                if (method === 'aria2.onDownloadStart') {
                    if (active.indexOf(gid) === -1) {
                        active.push(gid);
                    }
                }
                else {
                    active.splice(active.indexOf(gid), 1);
                    if (method === 'aria2.onDownloadComplete') {
                        var {bittorrent, files} = await aria2RPC.message('aria2.tellStatus', [gid]);
                        var name = getDownloadName(bittorrent, files);
                        getNotification(name, 'complete');
                    }
                }
            }
            chrome.browserAction.setBadgeText({text: active.length === 0 ? '' : active.length + ''});
        };
    }).catch(error => {
        chrome.browserAction.setBadgeText({text: 'E'});
        chrome.browserAction.setBadgeBackgroundColor({color: '#c33'});
    });
    if (aria2Store['show_notification'] === '0') {
        aria2Store['notify_start'] = '0';
        aria2Store['notify_complete'] = '0';
        delete aria2Store['show_notification'];
        chrome.storage.local.set(aria2Store);
    }
    else if (aria2Store['show_notification'] === '1') {
        aria2Store['notify_start'] = '1';
        aria2Store['notify_complete'] = '0';
        delete aria2Store['show_notification'];
        chrome.storage.local.set(aria2Store);
    }
    else if (aria2Store['show_notification'] === '2') {
        aria2Store['notify_start'] = '0';
        aria2Store['notify_complete'] = '1';
        delete aria2Store['show_notification'];
        chrome.storage.local.set(aria2Store);
    }
    else if (aria2Store['show_notification'] === '3') {
        aria2Store['notify_start'] = '1';
        aria2Store['notify_complete'] = '1';
        delete aria2Store['show_notification'];
        chrome.storage.local.set(aria2Store);
    }
}

function aria2Update() {
    if (self.aria2Socket && aria2Socket.readyState === 1) {
        aria2Socket.close();
    }
    aria2StartUp();
}

function aria2Download(url, hostname, options, cookies) {
    options['header'] = ['Cookie:'];
    options['user-agent'] = aria2Store['user_agent'];
    options['all-proxy'] = aria2Store['proxy_include'].find(host => hostname.endsWith(host)) ? aria2Store['proxy_server'] : '';
    cookies.forEach(({name, value}) => options['header'][0] += ' ' + name + '=' + value + ';');
    aria2RPC.message('aria2.addUri', [[url], options]).then(result => getNotification(url, 'start'));
}

function getFileExtension(filename) {
    return filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
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
