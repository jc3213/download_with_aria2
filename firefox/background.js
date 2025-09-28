let aria2Headers = new Set([ 'content-disposition', 'content-type', 'content-length' ]);

function captureHooking() {
    if (!aria2Storage['capture_enabled']) {
        captureDisabled();
    } else if (aria2Storage['capture_webrequest']) {
        browser.webRequest.onHeadersReceived.addListener(captureWebRequest, { urls: ['http://*/*', 'https://*/*'], types: ['main_frame', 'sub_frame'] }, ['blocking', 'responseHeaders']);
        browser.downloads.onCreated.removeListener(captureDownloads);
    } else {
        browser.webRequest.onHeadersReceived.removeListener(captureWebRequest);
        browser.downloads.onCreated.addListener(captureDownloads);
    }
}

function captureDisabled() {
    browser.downloads.onCreated.removeListener(captureDownloads);
    browser.webRequest.onHeadersReceived.removeListener(captureWebRequest);
}

async function captureDownloads({ id, url, referrer, filename, fileSize }) {
    if (url.startsWith('data') || url.startsWith('blob')) {
        return;
    }
    let hostname = getHostname(referrer);
    let captured = captureEvaluate(hostname, filename, fileSize);
    if (captured) {
        browser.downloads.cancel(id).then(() => {
            browser.downloads.erase({ id });
            downloadHandler(url, referrer, getFirefoxOptions(filename));
        });
    }
}

async function captureWebRequest({ statusCode, url, originUrl, responseHeaders, tabId }) {
    if (statusCode !== 200) {
        return;
    }
    let result = {};
    responseHeaders.forEach(({ name, value }) => {
        name = name.toLowerCase();
        if (aria2Headers.has(name)) {
            result[name] = value;
        }
    });
    if (!result['content-type']?.startsWith('application')) {
        return;
    }
    let out = decodeFileName(result['content-disposition']);
    let hostname = getHostname(originUrl);
    let captured = captureEvaluate(hostname, out, result['content-length'] | 0);
    if (captured) {
        downloadHandler(url, originUrl, { out }, tabId);
        return { cancel: true };
    }
}

function getFirefoxOptions(filename) {
    let [, dir, out] = filename.match(/^((?:[A-Z]:)?(?:[\\/][^\\/]+)+)[\\/]([^\\/]+)$/);
    if (!aria2Storage['folder_enabled']) {
        return { out };
    }
    if (aria2Storage['folder_firefox']) {
        return { out, dir };
    }
    return { out, dir: aria2Storage['folder_defined'] || null };
}

function decodeFileName(disposition) {
    if (!disposition?.startsWith('attachment')) {
        return null;
    }
    let RFC2047 = disposition.match(/filename="?(=\?[^;]+\?=)/);
    if (RFC2047) {
        return decodeRFC2047(RFC2047[1]);
    }
    let RFC5987 = disposition.match(/filename\*="?([^;]+''[^";]+)/i);
    if (RFC5987) {
        return decodeRFC5987(RFC5987[1]);
    }
    let match = disposition.match(/filename="?([^";]+);?/);
    if (match) {
        return decodeNonASCII(match.pop());
    }
    console.log(text);
    return null;
}

function decodeISO8859(text) {
    let decode = [];
    [...text].forEach((s) => {
        let c = s.charCodeAt(0);
        if (c < 256) {
            decode.push(c);
        }
    });
    return new TextDecoder('UTF-8').decode(Uint8Array.from(decode));
}

function decodeRFC5987(text) {
    let [, utf8, code, data] = text.match(/(?:(utf-?8)|([^']+))''([^']+)/i);
    if (utf8) {
        return decodeNonASCII(data);
    }
    let decode = [];
    data.match(/%[0-9a-fA-F]{2}|./g)?.forEach((s) => {
        let c = s.length === 3 ? parseInt(s.slice(1), 16) : s.charCodeAt(0);
        if (c < 256) {
            decode.push(c);
        }
    });
    return new TextDecoder(code).decode(Uint8Array.from(decode));
}

function decodeRFC2047(text) {
    let result = '';
    let decode;
    text.match(/[^\s]+/g).forEach((s) => {
        let [, code, b, q, data] = s.match(/=\?([^\?]+)\?(?:(b)|(q))\?([^\?]+)\?=/i);
        if (b) {
            decode = [...atob(data)].map(s => s.charCodeAt(0));
        } else if (q) {
            decode = data.match(/=[0-9a-fA-F]{2}|./g)?.map((v) => {
                return v === '_' ? 0x20 : v.length === 3 ? parseInt(v.slice(1), 16) : v.charCodeAt(0);
            });
        }
        if (decode) {
            result += new TextDecoder(code).decode(Uint8Array.from(decode));
        }
    });
    return result;
}

function decodeNonASCII(text) {
    console.log(text);
    let result = /[^\u0000-\u007f]/.test(text) ? decodeISO8859(text) : decodeURI(text);
    return result || null;
}
