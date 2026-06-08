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

async function captureDownloads(downloadItem) {
    let url = downloadItem.url;
    if (url.startsWith('data') || url.startsWith('blob')) {
        return;
    }
    let referer = downloadItem.referrer;
    let hostname = getHostname(referer);
    if (matchHostname(captureHosts, hostname)) {
        return;
    }
    let id = downloadItem.id;
    await browser.downloads.cancel(id);
    await browser.downloads.erase({ id });
    downloadHandler(url, referer, downloadItem.filename, hostname);
}

async function captureWebRequest(details) {
    if (details.statusCode !== 200) {
        return;
    }
    let referer = details.originUrl;
    let hostname = getHostname(referer);
    if (matchHostname(captureHosts, hostname)) {
        return;
    }
    let responseHeaders = details.responseHeaders;
    let result = {};
    for (let i = 0, l = responseHeaders.length; i < l; i++) {
        let header = responseHeaders[i];
        let name = header.name.toLowerCase();
        if (firefoxHeaders.has(name)) {
            result[name] = header.value;
        }
    }
    let contentType = result['content-type'];
    if (!contentType || !contentType.startsWith('application')) {
        return;
    }
    let filename = decodeFileName(result['content-disposition']);
    if (!filename || filename.startsWith('attachment')) {
        filename = null;
    }
    downloadHandler(details.url, referer, filename, hostname, details.tabId);
    return { cancel: true };
}

function decodeRFC2047(args) {
    let result = '';
    for (let i = 0, l = args.length; i < l; i++) {
        let bytes = [];
        let parts = args[i].split('?');
        let charset = parts[1];
        let type = parts[2];
        let string = parts[3];
        if (type.toLowerCase() === 'b') {
            let text = atob(string);
            for (let i = 0, l = text.length; i < l; i++) {
                bytes.push(text[i].charCodeAt(0));
            }
        } else {
            let sets = string.match(/=[0-9a-fA-F]{2}|[^=]/g);
            if (!sets) {
                continue;
            }
            for (let i = 0, l = sets.length; i < l; i++) {
                let q = sets[i];
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
    if (!disposition || !disposition.startsWith('attachment')) {
        return;
    }
    let RFC2047 = disposition.match(/=\?[^?]+\?[bqBQ]\?[^?]+\?=/g);
    if (RFC2047) {
        return decodeRFC2047(RFC2047);
    }
    let RFC5987 = disposition.match(/filename\*\s*=\s*"?([^']+)''([^";]+)"?/i);
    if (RFC5987) {
        return decodePlainText(RFC5987[1], RFC5987[2]);
    }
    let UNKNOWN = disposition.match(/filename="?([^";]+);?/);
    if (UNKNOWN) {
        return decodePlainText('UTF-8', UNKNOWN[1]);
    }
    return decodePlainText('UTF-8', disposition);
}
