let jsonrpc = null;
let secret = 'token:';

let pending = {};
let ports = new Set();

let wsSock = null;
let wsReady = false;

function wsOpen() {
    for (let port of ports) {
        port.postMessage({ type: 'ws:open' });
    }

    wsReady = true;
    return { ok: true };
}

function wsMessage(event) {
    let json = JSON.parse(event.data);

    if ('method' in json) {
        for (let port of ports) {
            port.postMessage({ type: 'ws:message', details: json });
        }
    } else {
        let id = json.id;
        pending[id](json);
        delete pending[id];
    }
}

function wsClose() {
    for (let port of ports) {
        port.postMessage({ type: 'ws:close' });
    }

    wsReady = false;
}

function wsSend(json) {
    return new Promise((resolve, reject) => {
        if (!wsReady) {
            reject({ error: 'Failed to send message to JSON-RPC' });
            return;
        }

        let id = json.id;
        pending[id] = resolve;
        wsSock.send(JSON.stringify(json));
    });
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

        wsSock.close();
    }

    return new Promise((resolve) => {
        wsSock = new WebSocket(jsonrpc);
        wsSock.onopen = () => resolve(wsOpen());
        wsSock.onmessage = wsMessage;
        wsSock.onerror = () => resolve({ error: 'Failed to open WebSocket connection' });
        wsSock.onclose = wsClose;
    });
}

function disconnect() {
    if (wsReady) {
        wsSock.close();
        return { ok: true };
    }

    return { error: 'WebSocket connection is not opened' };
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
