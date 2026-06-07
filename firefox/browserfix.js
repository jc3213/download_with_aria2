const firefoxHeaders = new Set(['content-disposition', 'content-type']);

function captureHooking() {
    if (!aria2Storage['capture_enabled']) {
        return;
    }
    if (aria2Storage['capture_webrequest']) {
        browser.webRequest.onHeadersReceived.addListener(captureWebRequest, { urls: systemURLs, types: ['main_frame', 'sub_frame'] }, ['blocking', 'responseHeaders']);
    } else {
        browser.downloads.onCreated.addListener(captureDownloads);
    }
}

function captureDisabled() {
    browser.downloads.onCreated.removeListener(captureDownloads);
    browser.webRequest.onHeadersReceived.removeListener(captureWebRequest);
}

async function captureDownloads({ id, url, referrer, filename }) {
    if (url.startsWith('data') || url.startsWith('blob')) {
        return;
    }
    let hostname = getHostname(referrer);
    if (matchHostname(captureHosts, hostname)) {
        return;
    }
    await browser.downloads.cancel(id);
    await browser.downloads.erase({ id });
    downloadHandler(url, referrer, filename, hostname);
}

async function captureWebRequest({ statusCode, url, originUrl, responseHeaders, tabId }) {
    if (statusCode !== 200) {
        return;
    }
    let hostname = getHostname(originUrl);
    if (matchHostname(captureHosts, hostname)) {
        return;
    }
    let result = {};
    for (let { name, value } of responseHeaders) {
        name = name.toLowerCase();
        if (firefoxHeaders.has(name)) {
            result[name] = value;
        }
    }
    if (!result['content-type']?.startsWith('application')) {
        return;
    }
    let filename = decodeFileName(result['content-disposition']);
    if (!filename || filename.startsWith('attachment')) {
        filename = null;
    }
    downloadHandler(url, originUrl, filename, hostname, tabId);
    return { cancel: true };
}

function decodeRFC2047(array) {
    let result = '';
    for (let i of array) {
        let bytes = [];
        let [, charset, type, string] = i.split('?');
        if (type.toLowerCase() === 'b') {
            for (let c of atob(string)) {
                bytes.push(c.charCodeAt(0));
            }
        } else {
            let parts = string.match(/=[0-9a-fA-F]{2}|[^=]/g);
            if (!parts) {
                continue;
            }
            for (let q of parts) {
                if (q.startsWith('=') && q.length === 3) {
                    bytes.push(parseInt(q.substring(1), 16));
                } else if (q === '_') {
                    bytes.push(0x20);
                } else {
                    bytes.push(q.charCodeAt(0));
                }
            }
        }
        result += new TextDecoder(charset).decode(new Uint8Array(bytes));
    }
    console.log(result);
    return result;
}

function decodeRFC5987(array) {
    let [, charset, string] = array;
    return decodePlainText(charset, string);
}

function decodeISO8859(charset, string) {
    let bytes = Uint8Array.from(string.split(''), (c) => c.charCodeAt(0));
    return new TextDecoder(charset).decode(bytes);
}

function decodePlainText(charset, string) {
    let result = /[^\u0000-\u007f]/.test(string) ? decodeISO8859(charset, string) : decodeURIComponent(string);
    console.log(result);
    return result;
}

function decodeFileName(disposition) {
    console.log(disposition);
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
    let string = disposition.match(/filename="?([^";]+);?/)?.[1] ?? disposition;
    return decodePlainText('UTF-8', string);
}
