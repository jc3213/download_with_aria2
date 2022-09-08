browser.contextMenus.create({
    title: browser.runtime.getManifest().name,
    id: 'downwitharia2firefox',
    contexts: ['link']
});

browser.contextMenus.onClicked.addListener((info, tab) => {
    var {linkUrl, pageUrl} = info;
    var {cookieStoreId} = tab;
    aria2Download(linkUrl, getHostname(pageUrl), cookieStoreId, {referer: pageUrl});
});

browser.storage.local.get(null, async json => {
    aria2Store = json['jsonrpc_uri'] ? json : await getDefaultOptions();
    aria2StartUp();
    aria2Capture();
});

browser.storage.onChanged.addListener(changes => {
    Object.keys(changes).forEach(key => {
        var {newValue} = changes[key];
        aria2Store[key] = newValue;
    });
    if (changes['jsonrpc_uri'] || changes['secret_token']) {
        aria2Update();
    }
    if (changes['capture_mode'] || changes['capture_api']) {
        aria2Capture();
    }
});

async function aria2Download(url, hostname, storeId, options) {
    var cookies = await browser.cookies.getAll({url, storeId, firstPartyDomain: null});
    options['user-agent'] = aria2Store['user_agent'];
    options['header'] = getRequestHeaders(cookies);
    options['all-proxy'] = getProxyServer(hostname);
    aria2RPC.message('aria2.addUri', [[url], options]).then(result => aria2WhenStart(url));
}

function aria2Capture() {
    if (aria2Store['capture_mode'] !== '0') {
        if (aria2Store['capture_api'] === '0') {
            browser.webRequest.onHeadersReceived.removeListener(webRequestCapture);
            browser.downloads.onCreated.addListener(downloadCapture);
        }
        else {
            browser.downloads.onCreated.removeListener(downloadCapture);
            browser.webRequest.onHeadersReceived.addListener(webRequestCapture, {urls: ["<all_urls>"], types: ["main_frame", "sub_frame"]}, ["blocking", "responseHeaders"]);
        }
    }
    else {
        browser.downloads.onCreated.removeListener(downloadCapture);
        browser.webRequest.onHeadersReceived.removeListener(webRequestCapture);
    }
}

async function downloadCapture({id, url, referrer, filename}) {
    if (url.startsWith('blob') || url.startsWith('data')) {
        return;
    }
    var [tab] = await browser.tabs.query({active: true, currentWindow: true});
    var referer = 'about:blank'.includes(referrer) ? tab.url : referrer;
    var hostname = getHostname(referer);
    if (getCaptureFilter(hostname, getFileExtension(filename))) {
        browser.downloads.cancel(id).then(async () => {
            browser.downloads.erase({id});
            var options = await getFirefoxOptions(referer, filename);
            aria2Download(url, hostname, tab.cookieStoreId, options);
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
        var out = disposition ? getFileName(disposition) : '';
        var hostname = getHostname(originUrl);
        if (getCaptureFilter(hostname, getFileExtension(out), length)) {
            var {cookieStoreId} = await browser.tabs.get(tabId);
            aria2Download(url, hostname, cookieStoreId, {referer: originUrl, out, dir: getDownloadFolder()});
            return {cancel: true};
        }
    }
}

async function getFirefoxOptions(referer, filename) {
    var {os} = await browser.runtime.getPlatformInfo();
    var index = os === 'win' ? filename.lastIndexOf('\\') : filename.lastIndexOf('/');
    var out = filename.slice(index + 1);
    if (aria2Store['folder_mode'] === '2') {
        return {referer, out, dir: filename.slice(0, index + 1)};
    }
    else if (aria2Store['folder_mode'] === '1' && aria2Store['folder_path']) {
        return {referer, out, dir: aria2Store['folder_path']};
    }
    else {
        return {referer, out};
    }
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
    if ('utf-8,utf8'.includes(head.toLowerCase())) {
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
