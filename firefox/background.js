var aria2WebRequest = {
    'content-disposition': true,
    'content-type': true,
    'content-length': true
};

function aria2CaptureSwitch() {
    if (aria2Storage['capture_enabled']) {
        if (aria2Storage['capture_webrequest']) {
            browser.webRequest.onHeadersReceived.addListener(webRequestCapture, {urls: ["<all_urls>"], types: ["main_frame", "sub_frame"]}, ["blocking", "responseHeaders"]);
            return browser.downloads.onCreated.removeListener(downloadCapture);
        }
        browser.webRequest.onHeadersReceived.removeListener(webRequestCapture);
        return browser.downloads.onCreated.addListener(downloadCapture);
    }
    browser.downloads.onCreated.removeListener(downloadCapture);
    browser.webRequest.onHeadersReceived.removeListener(webRequestCapture);
}

async function downloadCapture({id, url, referrer, filename, cookieStoreId}) {
    if (url.startsWith('data') || url.startsWith('blob')) {
        return;
    }
    var hostname = getHostname(referrer);
    var captured = aria2CaptureResult(hostname, getFileExtension(filename));
    if (captured) {
        browser.downloads.cancel(id).then(async () => {
            browser.downloads.erase({id});
            aria2DownloadPrompt(url, await getFirefoxOptions(filename), referrer, hostname, cookieStoreId);
        }).catch(error => aria2WhenComplete(url));
    }
}

async function webRequestCapture({statusCode, tabId, url, originUrl, responseHeaders}) {
    if (statusCode !== 200) {
        return;
    }
    var result = {};
    responseHeaders.forEach(({name, value}) => {
        if (name.toLowerCase() in aria2WebRequest) {
            result[name] = value;
        }
    });
    if (!result['content-type'].startsWith('application')) {
        return;
    }
    var disposition = result['content-disposition'];
    var out = null;
    var ext = null;
    if (disposition?.startsWith('attachment')) {
        out = getFileName(disposition);
        ext = getFileExtension(out);
    }
    var hostname = getHostname(originUrl);
    if (aria2CaptureResult(hostname, ext, result['content-length'])) {
        browser.tabs.get(tabId).then(({cookieStoreId}) => aria2DownloadPrompt(url, {out}, originUrl, hostname, cookieStoreId));
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
        if (aria2Storage['folder_defined'] !== '') {
            return {out, dir: aria2Storage['folder_defined']};
        }
    }
    return {out, dir: null};
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

chrome.action = browser.browserAction;
browser.storage.sync.get(null).then((json) => {
    aria2Storage = {...aria2Default, ...json};
    aria2UpdateStorage();
    aria2ClientSetUp();
    aria2CaptureSwitch();
    aria2ContextMenus();
    aria2TaskManager();
});
