browser.contextMenus.create({
    title: browser.runtime.getManifest().name,
    id: 'downwitharia2firefox',
    contexts: ['link']
});

browser.contextMenus.onClicked.addListener(({linkUrl, pageUrl}, {cookieStoreId}) => {
    startDownload(linkUrl, pageUrl, getDomainFromUrl(pageUrl), cookieStoreId);
});

browser.storage.local.get(null, async json => {
    aria2Store = json['jsonrpc_uri'] ? json : await fetch('/options.json').then(response => response.json());
    aria2Store['capture_api'] = aria2Store['capture_api'] ?? '1';
    !json['jsonrpc_uri'] && chrome.storage.local.set(aria2Store);
    statusIndicator();
    if (!aria2Store['proxy_include']) {
        aria2Store['proxy_include'] = [];
        aria2Store['capture_resolve'] = aria2Store['capture_resolve'] ?? aria2Store['type'] ?? [];
        delete aria2Store['proxy_resolve'];
        delete aria2Store['type'];
        chrome.storage.local.set(aria2Store);
    }
});

browser.storage.onChanged.addListener(changes => {
    Object.entries(changes).forEach(([key, {newValue}]) => aria2Store[key] = newValue);
    if (changes['jsonrpc_uri'] || changes['secret_token']) {
        self.jsonrpc && jsonrpc.readyState === 1 && jsonrpc.close();
        statusIndicator();
    }
});

browser.downloads.onCreated.addListener(async ({id, url, referrer, filename}) => {
    if (aria2Store['capture_api'] === '1' || aria2Store['capture_mode'] === '0' || url.startsWith('blob') || url.startsWith('data')) {
        return;
    }
    var {tabUrl, cookieStoreId} = await browser.tabs.query({active: true, currentWindow: true}).then(([{url, cookieStoreId}]) => ({tabUrl: url, cookieStoreId}));
    var referer = referrer ? referrer : tabUrl ?? 'about:blank';
    var domain = getDomainFromUrl(referer);
    captureDownload(domain, getFileExtension(filename)) && browser.downloads.cancel(id).then(async () => {
        await browser.downloads.erase({id}) && startDownload(url, referer, domain, cookieStoreId, await getFirefoxExclusive(filename));
    }).catch(error => showNotification('Download is already complete'));
});

browser.webRequest.onHeadersReceived.addListener(async ({statusCode, tabId, url, originUrl, responseHeaders}) => {
    if (aria2Store['capture_api'] === '0' || aria2Store['capture_mode'] === 0 || statusCode !== 200) {
        return;
    }
    var match = [{}, 'content-disposition', 'content-type', 'content-length'];
    responseHeaders.forEach(({name, value}) => match.includes(name = name.toLowerCase()) && (match[0][name.slice(name.indexOf('-') + 1)] = value));
    var {disposition, type, length} = match[0];
    if (type.startsWith('application') || disposition && disposition.startsWith('attachment')) {
console.log('--------------------------\n' + url + '\n' + originUrl + '\n');
        var out = disposition ? getFileName(disposition) : '';
console.log(out);
        var domain = getDomainFromUrl(originUrl);
        if (captureDownload(domain, getFileExtension(out), length)) {
            var {cookieStoreId} = await browser.tabs.get(tabId);
            startDownload(url, originUrl, domain, cookieStoreId, {out});
            return {cancel: true};
        }
    }
}, {urls: ["<all_urls>"], types: ["main_frame", "sub_frame"]}, ["blocking", "responseHeaders"]);

async function statusIndicator() {
    jsonrpc = await aria2RPCStatus(text => {
        browser.browserAction.setBadgeText({text: text === '0' ? '' : text});
        browser.browserAction.setBadgeBackgroundColor({color: text ? '#3cc' : '#c33'});
    });
}

async function startDownload(url, referer, domain, storeId = 'firefox-default', options = {}) {
    var cookies = await browser.cookies.getAll({url, storeId});
    options['header'] = ['Cookie:', 'Referer: ' + referer, 'User-Agent: ' + aria2Store['user_agent']];
    cookies.forEach(({name, value}) => options['header'][0] += ' ' + name + '=' + value + ';');
    options['all-proxy'] = aria2Store['proxy_include'].includes(domain) ? aria2Store['proxy_server'] : '';
    aria2RPCCall({method: 'aria2.addUri', params: [[url], options]}, result => showNotification(url));
}

function captureDownload(domain, type, size) {
    return aria2Store['capture_exclude'].includes(domain) ? false :
        aria2Store['capture_reject'].includes(type) ? false :
        aria2Store['capture_mode'] === '2' ? true :
        aria2Store['capture_include'].includes(domain) ? true :
        aria2Store['capture_resolve'].includes(type) ? true :
        aria2Store['capture_size'] > 0 && size >= aria2Store['capture_size'] ? true : false;
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
console.log('Not supported', disposition);
    return '';
}

function decodeISO8859(text) {
    var result = [];
    [...text].forEach(s => {
        var c = s.charCodeAt(0);
        c < 256 && result.push(c);
    });
    return new TextDecoder(document.characterSet ?? 'UTF-8').decode(Uint8Array.from(result));
}
function decodeRFC5987(text) {
    console.log('RFC5987', text);
    var head = text.slice(0, text.indexOf('\''));
    var body = text.slice(text.lastIndexOf('\'') + 1);
    if (['utf-8', 'utf8'].includes(head.toLowerCase())) {
        return decodeFileName(body);
    }
    var result = [];
    (body.match(/%[0-9a-fA-F]{2}|./g) ?? []).forEach(s => {
        var c = s.length === 3 ? parseInt(s.slice(1), 16) : s.charCodeAt(0);
        c < 256 && result.push(c);
    });
    return new TextDecoder(head).decode(Uint8Array.from(result));
}
function decodeRFC2047Word(text) {
    if (text.startsWith('=?') && text.endsWith('?=')) {
        var temp = text.slice(2, -2);
        var qs = temp.indexOf('?');
        var qe = temp.lastIndexOf('?');
        if (qe - qs === 2) {
            var code = temp.slice(0, qs);
            var type = temp.slice(qs + 1, qe).toLowerCase();
            var data = temp.slice(qe + 1);
            var result = type === 'b' ? [...atob(data)].map(s => s.charCodeAt(0)) :
                type === 'q' ? (parts[2].match(/=[0-9a-fA-F]{2}|./g) || []).map(v => v.length === 3 ?
                    parseInt(v.slice(1), 16) : v === '_' ? 0x20 : v.charCodeAt(0)) : null;
        }
    }
    return result ? new TextDecoder(code).decode(Uint8Array.from(result)) : '';
}
function decodeRFC2047(text) {
    console.log('RFC2047', text);
    var result = '';
    text.split(/\s+/).forEach(s => {
        var decode = decodeRFC2047Word(s);
        if (decode) {
            result += decode;
        }
    });
    return result;
}
function decodeFileName(text) {
    try {
        return /[^\u0000-\u007f]/.test(text) ? decodeISO8859(text) : decodeURI(text);
    }
    catch {
        return console.log(text) ?? '';
    }
}
