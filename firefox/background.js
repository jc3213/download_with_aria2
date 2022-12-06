browser.contextMenus.create({
    title: browser.runtime.getManifest().name,
    id: 'downwitharia2firefox',
    contexts: ['link']
});

browser.contextMenus.onClicked.addListener((info, tab) => {
    var {linkUrl, pageUrl} = info;
    var {cookieStoreId} = tab;
    aria2DownloadFirefox(linkUrl, pageUrl, getHostname(pageUrl), cookieStoreId);
});

browser.storage.local.get(null, async json => {
    aria2Store = 'jsonrpc_uri' in json ? json : await getDefaultOptions();
    aria2StartUp();
    aria2Capture();
});

browser.storage.onChanged.addListener(changes => {
    Object.keys(changes).forEach(key => {
        var {newValue} = changes[key];
        if (newValue !== undefined) {
            aria2Store[key] = newValue;
        }
    });
    if ('jsonrpc_uri' in changes || 'secret_token' in changes) {
        aria2Update();
    }
    if ('capture_enabled' in changes || 'capture_webrequest' in changes) {
        aria2Capture();
    }
});

async function getRequestHeadersFirefox(url, storeId) {
    var cookies = await browser.cookies.getAll({url, storeId, firstPartyDomain: null});
    var header = 'Cookie:';
    cookies.forEach(cookie => {
        var {name, value} = cookie;
        header += ' ' + name + '=' + value + ';';
    });
    return [header];
}

async function aria2DownloadFirefox(url, referer, hostname, storeId, options = {}) {
    options['user-agent'] = aria2Store['user_agent'];
    options['all-proxy'] = getProxyServer(hostname);
    if (aria2Store['download_headers']) {
        options['referer'] = referer;
        options['header'] = await getRequestHeadersFirefox(url, storeId);
    }
    aria2DownloadPrompt(url, options);
}

function aria2Capture() {
    if (aria2Store['capture_enabled']) {
        if (aria2Store['capture_webrequest']) {
            browser.downloads.onCreated.removeListener(downloadCapture);
            browser.webRequest.onHeadersReceived.addListener(webRequestCapture, {urls: ["<all_urls>"], types: ["main_frame", "sub_frame"]}, ["blocking", "responseHeaders"]);
        }
        else {
            browser.webRequest.onHeadersReceived.removeListener(webRequestCapture);
            browser.downloads.onCreated.addListener(downloadCapture);
        }
    }
    else {
        browser.downloads.onCreated.removeListener(downloadCapture);
        browser.webRequest.onHeadersReceived.removeListener(webRequestCapture);
    }
}

function getCaptureFilter(hostname, ext, size) {
    if (aria2Store['capture_exclude'].find(host => hostname.endsWith(host))) {
        return false;
    }
    else if (aria2Store['capture_reject'].includes(ext)) {
        return false;
    }
    else if (aria2Store['capture_always']) {
        return true;
    }
    else if (aria2Store['capture_include'].find(host => hostname.endsWith(host))) {
        return true;
    }
    else if (aria2Store['capture_resolve'].includes(ext)) {
        return true;
    }
    else if (aria2Store['capture_filesize'] > 0 && size >= aria2Store['capture_filesize']) {
        return true;
    }
    return false;
}

async function downloadCapture({id, url, referrer, filename, cookieStoreId}) {
    if (url.startsWith('blob') || url.startsWith('data')) {
        return;
    }
    var referer = 'about:blank'.includes(referrer) ? await getCurrentTabUrl() : referrer;
    var hostname = getHostname(referer);
    if (getCaptureFilter(hostname, getFileExtension(filename))) {
        browser.downloads.cancel(id).then(async () => {
            browser.downloads.erase({id});
            var options = await getFirefoxOptions(filename);
            aria2DownloadFirefox(url, referer, hostname, cookieStoreId, options);
        }).catch(error => aria2WhenComplete(url));
    }
}

async function webRequestCapture({statusCode, tabId, url, originUrl, responseHeaders}) {
    if (statusCode !== 200) {
        return;
    }
    var result = {};
    responseHeaders.forEach(({name, value}) => {
        name = name.toLowerCase();
        if ('content-disposition,content-type,content-length'.includes(name)) {
            result[name.slice(name.indexOf('-') + 1)] = value;
        }
    });
    var {disposition, type, length} = result;
    if (type.startsWith('application') || disposition && disposition.startsWith('attachment')) {
        if (disposition) {
            var out = getFileName(disposition);
            var ext = getFileExtension(out);
        }
        else {
            out = ext = null;
        }
        var hostname = getHostname(originUrl);
        if (getCaptureFilter(hostname, ext, length)) {
            var {cookieStoreId} = await browser.tabs.get(tabId);
            aria2DownloadFirefox(url, originUrl, hostname, cookieStoreId, {out, dir: getDownloadFolder()});
            return {cancel: true};
        }
    }
}

async function getFirefoxOptions(filename) {
    var {os} = await browser.runtime.getPlatformInfo();
    var idx = os === 'win' ? filename.lastIndexOf('\\') : filename.lastIndexOf('/');
    var out = filename.slice(idx + 1);
    if (aria2Store['folder_enabled']) {
        if (aria2Store['folder_firefox']) {
            return {out, dir: filename.slice(0, idx + 1)};
        }
        else if (aria2Store['folder_defined'] !== '') {
            return {out, dir: aria2Store['folder_defined']};
        }
    }
    return {out};
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
    var code = document.characterSet ?? 'UTF-8';
    [...text].forEach(s => {
        var c = s.charCodeAt(0);
        if (c < 256) {
            decode.push(c);
        }
    });
    return new TextDecoder(code).decode(Uint8Array.from(decode));
}

function decodeRFC5987(text) {
    var idx = text.indexOf('\'');
    var code = text.slice(0, idx).toLowerCase();
    var data = text.slice(idx + 2);
    if ('utf-8,utf8'.includes(code)) {
        return decodeFileName(data);
    }
    var decode = [];
    var tmp = data.match(/%[0-9a-fA-F]{2}|./g) ?? [];
    tmp.forEach(s => {
        var c = s.length === 3 ? parseInt(s.slice(1), 16) : s.charCodeAt(0);
        if (c < 256) {
            decode.push(c);
        }
    });
    return new TextDecoder(code).decode(Uint8Array.from(decode));
}

function decodeRFC2047(text) {
    var result = '';
    text.split(/\s+/).forEach(s => {
        if (s.startsWith('=?') && s.endsWith('?=')) {
            var raw = s.slice(2, -2);
            var si = raw.indexOf('?');
            var ei = raw.lastIndexOf('?');
            if (ei - si === 2) {
                var code = raw.slice(0, si);
                var type = raw.slice(si + 1, ei).toLowerCase();
                var data = raw.slice(ei + 1);
                if (type === 'b') {
                    var decode = [...atob(data)].map(s => s.charCodeAt(0));
                    result += new TextDecoder(code).decode(Uint8Array.from(decode));
                }
                else if (type === 'q') {
                    var tmp = data.match(/=[0-9a-fA-F]{2}|./g) ?? [];
                    var decode = tmp.map(v => {
                        if (v === '_') {
                            return 0x20;
                        }
                        else if (v.length === 3) {
                            return parseInt(v.slice(1), 16)
                        }
                        return v.charCodeAt(0);
                    });
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
