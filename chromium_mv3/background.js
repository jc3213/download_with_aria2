const aria2 = (() => {
    let pending = {};
    let index = 0;
    let connectId = 0;

    let retries = 10;
    let timeout = 10000;
    let events = {};

    let offscreen = new Promise((resolve) => {
        chrome.runtime.onConnect.addListener((port) => {
            if (port.name !== 'offscreen') {
                return;
            }

            port.onMessage.addListener((message) => {
                let func = events[message.type];

                if (func) {
                    func(message.details);
                    return;
                }

                let id = message.id;
                func = pending[id];

                if (func) {
                    func(message.result);
                    delete pending[id];
                }
            });

            resolve(port);
        });
    });

    chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['WORKERS'],
        justification: 'Host of SharedWorker'
    });

    function forecast(type, payload) {
        let id = type + 
            '-' +
            index++ +
            '-' + 
            Date.now().toString(36) +
            '-' +
            Math.random().toString(36).substring(2);

        return new Promise((resolve) => {
            pending[id] = resolve;
            offscreen.postMessage({ id, type, payload });
        });
    }

    async function broadcast(type, payload) {
        offscreen = await offscreen;
        broadcast = forecast;
        return forecast(type, payload);
    }

    async function connect(jsonrpc, secret) {
        let id = ++connectId;

        for (let i = 0; i <= retries; i++) {
            if (id !== connectId) {
                throw new Error('Connection aborted: operation cancelled');
            }

            let result = await broadcast('connect', { jsonrpc, secret });

            if (result.ok) {
                return true;
            }

            await new Promise((resolve) => setTimeout(resolve, timeout));
        }

        throw new Error('Connection failed: retries exhausted');
    }

    let aria2 = {
        call(method, params) {
            return broadcast('call', { method, params });
        },
        multicall(requests) {
            return broadcast('multicall', requests);
        },
        connect,
        disconnect() {
            return broadcast('disconnect');
        },
        subscribe() {
            return broadcast('subscribe');
        },
        unsubscribe() {
            return broadcast('unsubscribe');
        }
    };

    Object.defineProperty(aria2, 'onopen', {
        get() {
            return events['ws:open'];
        },
        set(callback) {
            if (typeof callback === 'function') {
                events['ws:open'] = callback;
            } else {
                events['ws:open'] = null;
            }
        }
    });

    Object.defineProperty(aria2, 'onclose', {
        get() {
            return events['ws:close'];
        },
        set(callback) {
            if (typeof callback === 'function') {
                events['ws:close'] = callback;
            } else {
                events['ws:close'] = null;
            }
        }
    });

    Object.defineProperty(aria2, 'onmessage', {
        get() {
            return events['ws:message'];
        },
        set(callback) {
            if (typeof callback === 'function') {
                events['ws:message'] = callback;
            } else {
                events['ws:message'] = null;
            }
        }
    });

    Object.defineProperty(aria2, 'retries', {
        get() {
            return retries;
        },
        set(number) {
            let n = number | 0;

            if (number < 0) {
                retries = Infinity;
            } else {
                retries = number;
            }
        }
    });

    Object.defineProperty(aria2, 'timeout', {
        get() {
            return timeout / 1000;
        },
        set(number) {
            let n = number | 0;

            if (n > 1) {
                timeout = n * 1000;
            } else {
                timeout = 1000;
            }
        }
    });

    return aria2;
})();

async function captureDownloads(downloadItem) {
    let url = downloadItem.finalUrl;

    if (url.startsWith('data') || url.startsWith('blob')) {
        return;
    }

    let referer = downloadItem.referrer;
    let hostname = getHostname(referer || url);

    if (matchHostname(captureHosts, hostname)) {
        return;
    }

    let id = downloadItem.id;

    await chrome.downloads.search({ id });
    await chrome.downloads.erase({ id });

    downloadHandler(url, referer, downloadItem.filename, hostname);
}

function captureHooking() {
    if (aria2Storage['capture_enabled']) {
        chrome.downloads.onDeterminingFilename.addListener(captureDownloads)
    }
}

function captureDisabled() {
    chrome.downloads.onDeterminingFilename.removeListener(captureDownloads);
}

setInterval(chrome.runtime.getPlatformInfo, 28000);
importScripts('application.js');
