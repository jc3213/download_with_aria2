let jsonrpc = null;
let secret = 'token:';
let current = 0;
let maximum = 10;
let interval = 10;

let pending = new Map();
let ports = new Set();

let wsSock = null;
let wsReady = false;

function wsOpen() {
    wsSock = new WebSocket(jsonrpc);

    wsSock.onmessage = (event) => {
        let json = JSON.parse(event.data);
        let id = json.id;

        if (id !== undefined) {
            let session = pending.get(id);

            if (session) {
                pending.delete(id);
                session.resolve(json);
            }
        } else {
            for (let port of ports) {
                port.postMessage({ type: 'ws:message', details: json });
            }
        }
    };

    wsSock.onclose = () => {
        wsReady = false;

        if (pending.size > 0) {
            for (let session of pending.values()) {
                session.reject(new Error('WebSocket connection closed'));
            }

            pending.clear();
        }

        for (let port of ports) {
            port.postMessage({ type: 'ws:close' });
        }

        if (current++ < maximum) {
            setTimeout(wsOpen, interval * 1000);
        } else {
            current = 0;
        }
    };

    return new Promise((resolve) => {
        wsSock.onopen = () => {
            current = 0;
            wsReady = true;

            for (let port of ports) {
                port.postMessage({ type: 'ws:open' });
            }

            resolve({ ok: true });
        };

        wsSock.onerror = () => {
            resolve({ error: 'Failed to open WebSocket connection' });
        };
    });
}

function wsSend(json) {
    return new Promise((resolve, reject) => {
        if (!wsReady) {
            reject({ error: 'Failed to send message via WebSocket' });
            return;
        }

        let id = json.id;
        pending.set(id, { resolve, reject });
        wsSock.send(JSON.stringify(json));
    });
}

function retries(port, id, value) {
    if (value == null) {
        return { ok: maximum };
    }

    if (!Number.isInteger(value)) {
        return { error: 'Invalid "retries": must be an integer' };
    }

    if (value < 0) {
        maximum = Infinity;
    } else {
        maximum = value;
    }

    return { ok: maximum };
}

function timeout(port, id, value) {
    if (value == null) {
        return { ok: interval };
    }

    if (!Number.isInteger(value)) {
        return { error: 'Invalid "retries": must be an integer' };
    }

    if (value > 0) {
        interval = value;
    } else {
        interval = 1;
    }

    return { ok: interval };
}

function connect(port, id, config) {
    let token = config.secret;

    if (token) {
        secret = 'token:' + token;
    }

    let url = config.jsonrpc;

    if (url.startsWith('http://') || url.startsWith('https://')) {
        jsonrpc = 'ws' + url.substring(4);
    } else if (url.startsWith('ws://') || url.startsWith('wss://')) {
        jsonrpc = url;
    } else {
        return { error: 'Invalid "jsonrpc": expected http(s):// or ws(s)://' };
    }

    if (wsReady) {
        if (wsSock.url === jsonrpc) {
            return { ok: true };
        }

        wsSock.onopen = null;
        wsSock.onmessage = null;
        wsSock.onerror = null;
        wsSock.onclose = null;
        wsSock.close();
    }

    current = 0;
    return wsOpen();
}

function disconnect() {
    if (wsReady) {
        current = Infinity;
        wsSock.close();
        return { ok: true };
    }

    return { error: 'WebSocket connection is closed' };
}

function subscribe(port) {
    if (wsReady) {
        port.postMessage({ type: 'ws:open' });
    }

    ports.add(port);
    return { ok: true };
}

function unsubscribe(port) {
    let ok = ports.delete(port);
    return { ok };
}

async function call(port, id, arg) {
    let params = arg.params;

    if (params) {
        params = [secret].concat(params);
    } else {
        params = [secret];
    }

    return wsSend({ jsonrpc: '2.0', id, method: arg.method, params });
}

async function multicall(port, id, args) {
    let calls = [];

    for (let i = 0, l = args.length; i < l; i++) {
        let arg = args[i];
        let params = arg.params;

        if (params) {
            params = [secret].concat(params);
        } else {
            params = [secret];
        }

        calls[i] = { methodName: arg.methodName, params };
    }

    return wsSend({ jsonrpc: '2.0', id, method: 'system.multicall', params: [calls] });
}

self.addEventListener('connect', (event) => {
    let port = event.ports[0];

    port.start();

    port.onmessage = async (ev) => {
        let data = ev.data;
        let type = data.type;
        let func = self[type];

        if (!func) {
            return;
        }

        let id = data.id;
        let result = await func(port, id, data.payload);
        port.postMessage({ id, type, result });
    };
});
