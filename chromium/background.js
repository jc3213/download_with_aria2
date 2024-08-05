var aria2WebRequest = {
    'content-disposition': true,
    'content-type': true,
    'content-length': true
};

chrome.downloads.onDeterminingFilename ??= browser.downloads.onCreated;
chrome.storage.sync.get(null, (json) => {
    aria2UpdateStorage({...aria2Default, ...json});
    aria2ClientSetup();
});

function aria2CaptureSwitch() {
    if (aria2Storage['capture_enabled']) {
        if (aria2Storage['capture_webrequest']) {
            chrome.webRequest.onHeadersReceived.addListener(captureWebRequest, {urls: ['<all_urls>'], types: ['main_frame', 'sub_frame']}, ['blocking', 'responseHeaders']);
            return chrome.downloads.onDeterminingFilename.removeListener(captureDownloads);
        }
        chrome.webRequest.onHeadersReceived.removeListener(captureWebRequest);
        return chrome.downloads.onDeterminingFilename.addListener(captureDownloads);
    }
    chrome.webRequest.onHeadersReceived.removeListener(captureWebRequest);
    chrome.downloads.onDeterminingFilename.removeListener(captureDownloads);
}

function captureDownloads({id, url, finalUrl, referrer, filename, fileSize}) {
    finalUrl ??= url;
    if (finalUrl.startsWith('data') || finalUrl.startsWith('blob')) {
        return;
    }
    var hostname = referrer ? getHostname(referrer) : getHostname(finalUrl);
    var captured = aria2CaptureResult(hostname, filename, fileSize);
    if (captured) {
        chrome.downloads.cancel(id, () => {
            chrome.downloads.erase({id});
            aria2DownloadHandler(finalUrl, {out: filename}, referrer, hostname); 
        });
    }
}

function captureWebRequest({statusCode, url, initiator, originUrl, responseHeaders, tabId}) {
    if (statusCode !== 200) {
        return;
    }
    var result = {};
    responseHeaders.forEach(({name, value}) => {
        name = name.toLowerCase();
        if (aria2WebRequest[name]) {
            result[name] = value;
        }
    });
    if (!result['content-type']?.startsWith('application')) {
        return;
    }
    var disposition = result['content-disposition'];
    if (disposition?.startsWith('attachment')) {
        var out = getFileName(disposition);
    }
    initiator ??= originUrl;
    var hostname = getHostname(initiator);
    if (aria2CaptureResult(hostname, out, result['content-length'] | 0)) {
        aria2DownloadHandler(url, {out}, initiator, hostname, tabId);
        return {cancel: true};
    }
}

function getFileName(disposition) {
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
    var [string, utf8, code, data] = text.match(/(?:(utf-?8)|([^']+))''([^']+)/i);
    if (utf8) {
        return decodeFileName(data);
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

function decodeFileName(text) {
    try {
        return /[^\u0000-\u007f]/.test(text) ? decodeISO8859(text) : decodeURI(text);
    }
    catch {
        return '';
    }
}
