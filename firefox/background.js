browser.contextMenus.create({
    title: browser.runtime.getManifest().name,
    id: 'downwitharia2firefox',
    contexts: ['link']
});

browser.contextMenus.onClicked.addListener(({linkUrl, pageUrl}, {cookieStoreId}) => {
    startDownload(linkUrl, getHostname(pageUrl), cookieStoreId, {referer: pageUrl});
});

browser.storage.local.get(null, async json => {
    aria2Store = json['jsonrpc_uri'] ? json : await fetch('/options.json').then(response => response.json());
    aria2StartUp();
    switchableAPI();
    !json['jsonrpc_uri'] && chrome.storage.local.set(aria2Store);
});

browser.storage.onChanged.addListener(changes => {
    Object.entries(changes).forEach(([key, {newValue}]) => aria2Store[key] = newValue);
    if (changes['jsonrpc_uri'] || changes['secret_token']) {
        aria2StartUp();
    }
    if (changes['capture_api']) {
        switchableAPI();
    }
});

async function startDownload(url, hostname, storeId, options) {
    var cookies = await browser.cookies.getAll({url, storeId});
    options['header'] = ['Cookie:'];
    options['user-agent'] = aria2Store['user_agent'];
    options['all-proxy'] = aria2Store['proxy_include'].find(host => hostname.endsWith(host)) ? aria2Store['proxy_server'] : '';
    cookies.forEach(({name, value}) => options['header'][0] += ' ' + name + '=' + value + ';');
    aria2RPC.message('aria2.addUri', [[url], options]).then(result => showNotification(url));
}

async function downloadsAPI({id, url, referrer, filename}) {
    if (aria2Store['capture_mode'] === '0' || url.startsWith('blob') || url.startsWith('data')) {
        return;
    }
    var {tabUrl, cookieStoreId} = await browser.tabs.query({active: true, currentWindow: true}).then(([{url, cookieStoreId}]) => ({tabUrl: url, cookieStoreId}));
    var referer = referrer && referrer !== 'about:blank' ? referrer : tabUrl;
    var hostname = getHostname(referer);
    captureDownload(hostname, getFileExtension(filename)) && browser.downloads.cancel(id).then(async () => {
        await browser.downloads.erase({id});
        var options = await getFirefoxExclusive(filename);
        startDownload(url, hostname, cookieStoreId, {referer, ...options});
    }).catch(error => showNotification('Download is already complete'));
}

async function webRequestAPI({statusCode, tabId, url, originUrl, responseHeaders}) {
    if (aria2Store['capture_mode'] === 0 || statusCode !== 200) {
        return;
    }
    var match = [{}, 'content-disposition', 'content-type', 'content-length'];
    responseHeaders.forEach(({name, value}) => match.includes(name = name.toLowerCase()) && (match[0][name.slice(name.indexOf('-') + 1)] = value));
    var {disposition, type, length} = match[0];
    if (type.startsWith('application') || disposition && disposition.startsWith('attachment')) {
        var out = disposition ? getFileName(disposition) : '';
        var hostname = getHostname(originUrl);
        if (captureDownload(hostname, getFileExtension(out), length)) {
            var {cookieStoreId} = await browser.tabs.get(tabId);
            startDownload(url, hostname, cookieStoreId, {referer: originUrl, out});
            return {cancel: true};
        }
    }
}

function switchableAPI() {
    if (aria2Store['capture_api'] === '0') {
        browser.webRequest.onHeadersReceived.removeListener(webRequestAPI);
        browser.downloads.onCreated.addListener(downloadsAPI);
    }
    else {
        browser.downloads.onCreated.removeListener(downloadsAPI);
        browser.webRequest.onHeadersReceived.addListener(webRequestAPI, {urls: ["<all_urls>"], types: ["main_frame", "sub_frame"]}, ["blocking", "responseHeaders"]);
    }
}

async function getFirefoxExclusive(uri) {
    var {os} = await browser.runtime.getPlatformInfo();
    var index = os === 'win' ? uri.lastIndexOf('\\') : uri.lastIndexOf('/');
    var out = uri.slice(index + 1);
    var dir = aria2Store['folder_mode'] === '1' ? uri.slice(0, index + 1) : aria2Store['folder_mode'] === '2' ? aria2Store['folder_path'] : null;
    return dir ? {dir, out} : {out};
}

function getFileName(disposition) {
    var RFC2047 = /filename="?(=\?[^;]+\?=)/.exec(disposition);
    if (RFC2047) {
        return decodeRFC2047(RFC2047[1]);
    }
    var RFC5987 = /filename\*="?([^;]+''[^";]+)/i.exec(disposition);
    if (RFC5987) {
        return decodeRFC5987(RFC5987[1]);
    }
    var match = /filename="?([^";]+);?/.exec(disposition);
    if (match) {
        return decodeFileName(match.pop());
    }
    return '';
}

function decodeISO8859(text) {
    var decode = [];
    [...text].forEach(s => {
        var c = s.charCodeAt(0);
        c < 256 && decode.push(c);
    });
    return new TextDecoder(document.characterSet ?? 'UTF-8').decode(Uint8Array.from(decode));
}

function decodeRFC5987(text) {
    var head = text.slice(0, text.indexOf('\''));
    var body = text.slice(text.lastIndexOf('\'') + 1);
    if (['utf-8', 'utf8'].includes(head.toLowerCase())) {
        return decodeFileName(body);
    }
    var decode = [];
    (body.match(/%[0-9a-fA-F]{2}|./g) ?? []).forEach(s => {
        var c = s.length === 3 ? parseInt(s.slice(1), 16) : s.charCodeAt(0);
        c < 256 && decode.push(c);
    });
    return new TextDecoder(head).decode(Uint8Array.from(decode));
}

function decodeRFC2047(text) {
    var result = '';
    text.split(/\s+/).forEach(s => {
        if (s.startsWith('=?') && s.endsWith('?=')) {
            var temp = s.slice(2, -2);
            var qs = temp.indexOf('?');
            var qe = temp.lastIndexOf('?');
            if (qe - qs === 2) {
                var code = temp.slice(0, qs);
                var type = temp.slice(qs + 1, qe).toLowerCase();
                var data = temp.slice(qe + 1);
                var decode = type === 'b' ? [...atob(data)].map(s => s.charCodeAt(0)) :
                    type === 'q' ? (parts[2].match(/=[0-9a-fA-F]{2}|./g) || []).map(v => v.length === 3 ?
                        parseInt(v.slice(1), 16) : v === '_' ? 0x20 : v.charCodeAt(0)) : null;
                if (decode) {
                    result += new TextDecoder(code).decode(Uint8Array.from(decode));
                }
            }
        }
    });
    return result;
}

function decodeFileName(text) {
    try {
        return /[^\u0000-\u007f]/.test(text) ? decodeISO8859(text) : decodeURI(text);
    }
    catch {
        return '';
    }
}
