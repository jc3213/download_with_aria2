var aria2WebRequest = {
    'content-disposition': true,
    'content-type': true,
    'content-length': true
};

function aria2CaptureSwitch() {
    if (!aria2Storage['capture_enabled']) {
        browser.downloads.onCreated.removeListener(aria2CaptureDownloads);
        browser.webRequest.onHeadersReceived.removeListener(aria2CaptureWebRequest);
    } else if (aria2Storage['capture_webrequest']) {
        browser.webRequest.onHeadersReceived.addListener(aria2CaptureWebRequest, {urls: ['<all_urls>'], types: ['main_frame', 'sub_frame']}, ['blocking', 'responseHeaders']);
        browser.downloads.onCreated.removeListener(aria2CaptureDownloads);
    } else {
        browser.webRequest.onHeadersReceived.removeListener(aria2CaptureWebRequest);
        browser.downloads.onCreated.addListener(aria2CaptureDownloads);
    }
}

async function aria2CaptureDownloads({id, url, referrer, filename, fileSize, cookieStoreId}) {
    if (!aria2RPC.alive || url.startsWith('data') || url.startsWith('blob')) {
        return;
    }
    var hostname = getHostname(referrer);
    var captured = aria2CaptureResult(hostname, filename, fileSize);
    if (captured) {
        browser.downloads.cancel(id).then(async () => {
            browser.downloads.erase({id});
            aria2DownloadHandler(url, await getFirefoxOptions(filename), referrer, hostname, cookieStoreId);
        }).catch(error => aria2WhenComplete(url));
    }
}

async function aria2CaptureWebRequest({statusCode, url, originUrl, responseHeaders, tabId}) {
    if (!aria2RPC.alive || statusCode !== 200) {
        return;
    }
    var result = {};
    responseHeaders.forEach(({name, value}) => {
        name = name.toLowerCase();
        if (aria2WebRequest[name]) {
            result[name] = value;
        }
    });
    if (!result['content-type'].startsWith('application')) {
        return;
    }
    var disposition = result['content-disposition'];
    if (disposition?.startsWith('attachment')) {
        var out = decodeFileName(disposition);
    }
    var hostname = getHostname(originUrl);
    if (aria2CaptureResult(hostname, out, result['content-length'] | 0)) {
        aria2DownloadHandler(url, {out}, originUrl, hostname, tabId);
        return {cancel: true};
    }
}

async function getFirefoxOptions(filename) {
    var {os} = await browser.runtime.getPlatformInfo();
    var idx = os === 'win' ? filename.lastIndexOf('\\') : filename.lastIndexOf('/');
    var out = filename.slice(idx + 1);
    if (aria2Storage['folder_enabled']) {
        if (aria2Storage['folder_firefox']) {
            return {out, dir: filename.slice(0, idx + 1)};
        }
        if (aria2Storage['folder_defined']) {
            return {out, dir: aria2Storage['folder_defined']};
        }
    }
    return {out, dir: null};
}

function decodeFileName(disposition) {
    var RFC2047 = disposition.match(/filename="?(=\?[^;]+\?=)/);
    if (RFC2047) {
        return decodeRFC2047(RFC2047[1]);
    }
    var RFC5987 = disposition.match(/filename\*="?([^;]+''[^";]+)/i);
    if (RFC5987) {
        return decodeRFC5987(RFC5987[1]);
    }
    var match = disposition.match(/filename="?([^";]+);?/);
    if (match) {
        return decodeNonASCII(match.pop());
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
    var [string, utf8, code, data] = text.match(/(?:(utf-?8)|([^']+))''([^']+)/i);
    if (utf8) {
        return decodeNonASCII(data);
    }
    var decode = [];
    data.match(/%[0-9a-fA-F]{2}|./g)?.forEach(s => {
        var c = s.length === 3 ? parseInt(s.slice(1), 16) : s.charCodeAt(0);
        if (c < 256) {
            decode.push(c);
        }
    });
    return new TextDecoder(code).decode(Uint8Array.from(decode));
}

function decodeRFC2047(text) {
    var result = '';
    text.match(/[^\s]+/g).forEach(s => {
        var [string, code, b, q, data] = s.match(/=\?([^\?]+)\?(?:(b)|(q))\?([^\?]+)\?=/i);
        if (b) {
            var decode = [...atob(data)].map(s => s.charCodeAt(0));
        }
        if (q) {
            decode = data.match(/=[0-9a-fA-F]{2}|./g)?.map(v => {
                if (v === '_') {
                    return 0x20;
                }
                if (v.length === 3) {
                    return parseInt(v.slice(1), 16)
                }
                return v.charCodeAt(0);
            });
        }
        if (decode) {
            result += new TextDecoder(code).decode(Uint8Array.from(decode));
        }
    });
    return result;
}

function decodeNonASCII(text) {
    try {
        return /[^\u0000-\u007f]/.test(text) ? decodeISO8859(text) : decodeURI(text);
    }
    catch {
        return '';
    }
}
