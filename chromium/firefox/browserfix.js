let aria2Headers = new Set([ 'content-disposition', 'content-type', 'content-length' ]);

function captureHooking() {
    if (aria2Storage['capture_webrequest']) {
        browser.webRequest.onHeadersReceived.addListener(captureWebRequest, { urls: ['http://*/*', 'https://*/*'], types: ['main_frame', 'sub_frame'] }, ['blocking', 'responseHeaders']);
    } else if (aria2Storage['capture_enabled']) {
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
            downloadHandler(url, referrer, filename, hostname);
        });
    }
}

async function captureWebRequest({ statusCode, url, originUrl, responseHeaders, tabId }) {
    if (statusCode !== 200) {
        return;
    }
    let result = {};
    for (let { name, value } of responseHeaders) {
        name = name.toLowerCase();
        if (aria2Headers.has(name)) {
            result[name] = value;
        }
    }
    if (!result['content-type']?.startsWith('application')) {
        return;
    }
    let filename = decodeFileName(result['content-disposition']) || null;
    let hostname = getHostname(originUrl);
    let captured = captureEvaluate(hostname, filename, result['content-length'] | 0);
    if (captured) {
        downloadHandler(url, originUrl, filename, hostname, tabId);
        return { cancel: true };
    }
}

function decodeRFC2047(array) {
    let result = '';
    for (let s of array) {
        let [, code, type, data] = s.split('?');
        let bytes;
        if (type.toLowerCase() === 'b') {
            bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
        } else {
            let parts = data.match(/=[0-9a-fA-F]{2}|[^=]/g);
            if (!parts) {
                continue;
            }
            let tmp = [];
            for (let q of parts) {
                if (q.length === 3) {
                    tmp.push(parseInt(q.substring(1), 16));
                } else if (q === '_') {
                    tmp.push(0x20);
                } else {
                    tmp.push(q.charCodeAt(0));
                }
            }
            bytes = new Uint8Array(tmp);
        }
        result += new TextDecoder(code).decode(bytes);
    }
    console.log(result);
    return result;
}

function decodeRFC5987(array) {
    let [, code, data] = array;
    return decodePlainText(code, data);
}

function decodeISO8859(code, text) {
    let bytes = Uint8Array.from(test.split(''), (c) => c.charCodeAt(0));
    return new TextDecoder(code).decode(bytes);
}

function decodePlainText(code, text) {
    let result = /[^\u0000-\u007f]/.test(text) ? decodeISO8859(code, text) : decodeURIComponent(text);
    console.log(result);
    return result;
}

function decodeFileName(disposition) {
    if (!disposition?.startsWith('attachment')) {
        return;
    }
    let RFC2047 = disposition.match(/=\?[^?]+\?[bqBQ]\?[^?]+\?=/g);
    if (RFC2047) {
        return decodeRFC2047(RFC2047);
    }
    let RFC5987 = disposition.match(/filename\*\s*=\s*"?([^']+)''([^";]+)"?/i);
    if (RFC5987) {
        return decodeRFC5987(RFC5987);
    }
    let text = disposition.match(/filename="?([^";]+);?/)?.[1] ?? disposition;
    return decodePlainText('UTF-8', text);
}
