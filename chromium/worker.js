const aria2 = (() => {
    let pending = {};
    let index = 0;
    let connectId = 0;

    let retries = 10;
    let timeout = 10000;
    let events = {};

    let shared = document.currentScript.src.replace('worker.js', 'shared.js');
    let worker = new SharedWorker(shared, { name: 'aria2-socket-worker' });
    let port = worker.port;

    port.start();

    port.onmessage = (event) => {
        let data = event.data;
        let func = events[data.type];

        if (func) {
            func(data.details);
            return;
        }

        let id = data.id;
        func = pending[id];

        if (func) {
            func(data.result);
            delete pending[id];
        }
    };

    function broadcast(type, payload) {
        let id = type + 
            '-' +
            index++ +
            '-' + 
            Date.now().toString(36) +
            '-' +
            Math.random().toString(36).substring(2);

        return new Promise((resolve) => {
            pending[id] = resolve;
            port.postMessage({ id, type, payload });
        });
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
