const aria2 = (() => {
    let hash = Date.now().toString(36) + '-' + Math.random().toString(36).substring(2);
    let index = 0;

    let events = {};
    let options = new Set(['retries', 'timeout'])
    let pending = new Map();

    let port = new Promise(async (resolve, reject) => {
        if (typeof window !== 'undefined' && typeof SharedWorker !== 'undefined') {
            let worker = new SharedWorker('/aria2-socket-worker.js', { name: 'aria2-socket-worker' });
            let port = worker.port;
            port.start();

            window.addEventListener('pagehide', () => {
                aria2.unsubscribe();
            });

            resolve(port);
            return;
        }

        if (typeof chrome !== 'undefined' && chrome.offscreen !== 'undefined') {
            let offscreen = chrome.runtime.getURL('/offscreen.html');

            chrome.runtime.onConnect.addListener((port) => {
                if (port.name === 'offscreen') {
                    resolve(port);
                }
            });

            chrome.offscreen.createDocument({
                url: offscreen,
                reasons: ['WORKERS'],
                justification: 'Host of SharedWorker'
            }).catch(reject);

            return;
        }

        reject(new Error('Unsupported runtime environment'));
    });
    
    let message = port.then((port) => {
        port.onmessage = (event) => {
            let data = event.data;
            let id = data.id;

            let func = pending.get(id);

            if (func) {
                pending.delete(id);
                func(data.result);
                return;
            }

            let post = events[data.type];

            if (post) {
                post(data.details);
                return;
            }
        };

        return function(type, payload) {
            let id = hash + '-' + index++ + '-' + type;

            return new Promise((resolve) => {
                pending.set(id, resolve);
                port.postMessage({ id, type, payload });
            });
        };
    });

    async function broadcast(type, payload) {
        broadcast = await message;
        return broadcast(type, payload);
    }

    function eventHandler(type, callback) {
        if (typeof callback === 'function') {
            events[type] = callback;
        } else {
            events[type] = null;
        }
    }

    let aria2 = {
        call(method, params) {
            return broadcast('call', { method, params });
        },
        multicall(requests) {
            return broadcast('multicall', requests);
        },
        connect(jsonrpc, secret) {
            return broadcast('connect', { jsonrpc, secret });
        },
        disconnect() {
            return broadcast('disconnect');
        },
        retries(value) {
            return broadcast('retries', value);
        },
        timeout(value) {
            return broadcast('timeout', value);
        },
        set onopen(callback) {
            eventHandler('ws:open', callback);
        },
        get onopen() {
            return events['ws:open'];
        },
        set onclose(callback) {
            eventHandler('ws:close', callback);
        },
        get onclose() {
            return events['ws:close'];
        },
        set onmessage(callback) {
            eventHandler('ws:message', callback);
        },
        get onmessage() {
            return events['ws:message'];
        },
        subscribe() {
            return broadcast('subscribe');
        },
        unsubscribe() {
            return broadcast('unsubscribe');
        }
    };

    return aria2;
})();
