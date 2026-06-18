const addonManager = chrome.runtime.getURL('/pages/popup/popup.html');
const addonImages = chrome.runtime.getURL('/pages/images/images.html');
const addonDownload = chrome.runtime.getURL('/pages/newdld/newdld.html');
const systemManifest = chrome.runtime.getManifest();
const systemFirefox = systemManifest.browser_specific_settings;
const systemHeaders = systemFirefox ? ['requestHeaders'] : ['requestHeaders', 'extraHeaders'];
const systemURLs = ['http://*/*', 'https://*/*'];
const systemStorage = {
    'jsonrpc_url': 'ws://localhost:6800/jsonrpc',
    'jsonrpc_secret': '',
    'jsonrpc_retries': -1,
    'jsonrpc_timeout': 10,
    'manager_newtab': false,
    'manager_interval': 10,
    'manager_filters': [],
    'ctxmenu_enabled': true,
    'ctxmenu_cascade': true,
    'ctxmenu_thisurl': true,
    'ctxmenu_thisimage': true,
    'ctxmenu_allimages': true,
    'notify_start': false,
    'notify_complete': false,
    'headers_override': false,
    'headers_useragent': 'Transmission/4.0.0',
    'headers_hosts': [],
    'folder_defined': '',
    'folder_enabled': false,
    'folder_firefox': false,
    'proxy_server': '',
    'proxy_hosts': [],
    'capture_enabled': false,
    'capture_webrequest': false,
    'capture_hosts': []
};

let aria2Storage = {};
let aria2Config = {};
let aria2Version;
let aria2Active = new Set();
let aria2Inspect = new Map();

let captureHosts;
let proxyHosts;
let headersHosts;

const aria2RPC = new Aria2();
aria2RPC.onopen = () => {
    aria2RPC.multicall([
        { methodName: 'aria2.tellActive' },
        { methodName: 'aria2.getGlobalOption' },
        { methodName: 'aria2.getVersion' }
    ]).then((response) => {
        let result = response.result;
        let active = result[0][0];
        let options = result[1][0];
        aria2Version = result[2][0];

        for (let i = 0, l = RawKeys.length; i < l; i++) {
            let key = RawKeys[i];
            aria2Config[key] = options[key];
        }

        for (let i = 0, l = SizeKeys.length; i < l; i++) {
            let key = SizeKeys[i];
            aria2Config[key] = RawToSize(options[key]);
        }

        for (let i = 0, l = active.length; i < l; i++) {
            aria2Active.add(active[i].gid);
        }

        captureHooking();
        toolbarCounter();
        chrome.action.setBadgeBackgroundColor({ color: '#1C4CD4' });
    }).catch(aria2RPC.onclose);
};

aria2RPC.onclose = () => {
    aria2Version = null;
    aria2Active = new Set();
    captureDisabled();
    chrome.action.setBadgeText({ text: 'E' });
    chrome.action.setBadgeBackgroundColor({ color: '#D33A26' });
};

aria2RPC.onmessage = (message) => {
    let method = message.method;

    if (method === 'aria2.onBtDownloadComplete') {
        return;
    }

    let gid = message.params[0].gid;

    if (method === 'aria2.onDownloadStart') {
        if (!aria2Active.has(gid)) {
            aria2Active.add(gid);
            downloadNotify('start', gid);
        }
    } else {
        aria2Active.delete(gid);

        if (method === 'aria2.onDownloadComplete') {
            downloadNotify('complete', gid);
        }
    }

    toolbarCounter();
};

const RawKeys = [
    'dir',
    'file-allocation',
    'allow-overwrite',
    'max-concurrent-downloads',
    'max-tries',
    'retry-wait',
    'split',
    'max-connection-per-server',
    'user-agent',
    'listen-port',
    'bt-max-peers',
    'enable-dht',
    'enable-dht6',
    'follow-torrent',
    'bt-remove-unselected-file',
    'seed-ratio',
    'seed-time'
];

const SizeKeys = [
    'disk-cache',
    'min-split-size',
    'max-overall-download-limit',
    'max-overall-upload-limit'
];

function RawToSize(bytes) {
    if (bytes < 1024) {
        return bytes;
    }

    if (bytes < 1048576) {
        return (bytes / 10.24 | 0) / 100 + 'K';
    }

    return (bytes / 10485.76 | 0) / 100 + 'M';
}

async function downloadNotify(type, gid) {
    if (!aria2Storage['notify_' + type]) {
        return;
    }

    let response = await aria2RPC.call('aria2.tellStatus', [gid]);
    let result = response.result;
    let bittorrent = result.bittorrent;
    let file = result.files[0];
    let path = file.path;
    let uris = file.uris;
    let title = chrome.i18n.getMessage('download_' + type);
    let message = bittorrent?.info?.name || path?.substring(path.lastIndexOf('/') + 1) || uris[0]?.uri || gid;

    chrome.notifications.create({ title, message, type: 'basic', iconUrl: '/icons/48.png' });
}

function downloadHeaders(tabId, url, referer) {
    let result = [];
    let headers;
    let inspect = aria2Inspect.get(tabId);

    if (inspect) {
        headers = inspect[url];
    }

    if (!headers) {
        for (let tab of aria2Inspect.values()) {
            let value = tab[url];
            if (value) {
                headers = value;
            }
        }
    }

    if (!headers) {
        headers = [{ name: 'Referer', value: referer }];
    }

    let oldUA = navigator.userAgent;

    for (let i = 0, l = headers.length; i < l; i++) {
        let header = headers[i];
        let name = header.name;
        let value = header.value;

        if (name.length === 10 && name.toLowerCase() === 'user-agent') {
            oldUA = value;
        } else {
            result.push(name + ': ' + value);
        }
    }

    let newUA = aria2Storage['headers_override'] ? aria2Storage['headers_useragent'] : oldUA;
    result.push('User-Agent: ' + newUA);

    return result;
}

function downloadDirectory(filename) {
    let dir = null;
    let out = filename;
    let user = aria2Storage['folder_defined'];

    if (out) {
        let idx = Math.max(out.lastIndexOf('/'), out.lastIndexOf('\\')) + 1;

        if (idx > 0) {
            dir = filename.substring(0, idx);
            out = filename.substring(idx);
        }
    }

    if (aria2Storage['folder_enabled'] &&
        !(systemFirefox && aria2Storage['folder_firefox']) &&
        user) {
        dir = user;
    }

    return { dir, out };
}

function downloadHandler(url, referer, filename, hostname, tabId) {
    let options = downloadDirectory(filename);

    if (!hostname) {
        hostname = getHostname(referer);
    }

    if (matchHostname(proxyHosts, hostname)) {
        options['all-proxy'] = aria2Storage['proxy_server'];
    }

    if (!matchHostname(headersHosts, hostname)) {
        options['header'] = downloadHeaders(tabId, url, referer);
    }

    aria2RPC.call('aria2.addUri', [[url], options]);
}

function getHostname(url) {
    let start = url.indexOf('//') + 2;
    let end = url.indexOf('/', start);
    let host = url.substring(start, end);
    let at = host.indexOf('@');

    if (at !== -1) {
        host = host.substring(at + 1);
    }

    let colon = host.indexOf(':');

    if (colon !== -1) {
        host = host.substring(0, colon);
    }

    return host;
}

function matchHostname(rules, host) {
    if (rules.size === 0) {
        return false;
    }

    if (rules.has('*')) {
        return true;
    }

    for (;;) {
        if (rules.has(host)) {
            return true;
        }
        let dot = host.indexOf('.');
        if (dot === -1) {
            return false;
        }
        host = host.substring(dot + 1);
    }
}

function toolbarCounter() {
    let number = aria2Active.size;
    chrome.action.setBadgeText({ text: !number ? '' : `${number}` });
}

function openPopupWindow(url, height) {
    chrome.windows.getCurrent((window) => {
        let top = (window.top + window.height - height) / 2 | 0;
        let left = (window.left + window.width - 710) / 2 | 0;
        let width = 698;

        chrome.tabs.query({ url }, (tabs) => {
            let tab = tabs[0];
            if (tab) {
                chrome.windows.update(tab.windowId, { focused: true, left, width, top, height });
                chrome.tabs.update(tab.id, { url, active: true });
            } else {
                chrome.windows.create({ url, type: 'popup', left, width, top, height });
            }
        });
    });
}

function storageDispatch(json) {
    aria2Storage = json;
    aria2RPC.url = json['jsonrpc_url'];
    aria2RPC.secret = json['jsonrpc_secret'];
    aria2RPC.retries = json['jsonrpc_retries'];
    aria2RPC.timeout = json['jsonrpc_timeout'];
    aria2RPC.connect();
    headersHosts = new Set(json['headers_hosts']);
    proxyHosts = new Set(json['proxy_hosts']);
    captureHosts = new Set(json['capture_hosts']);
    popupMenuEnabler(json);
    contextMenusEnabler(json);
}

chrome.storage.sync.get(null, (json) => {
    let storage = { ...systemStorage, ...json };
    storageDispatch(storage);
});
