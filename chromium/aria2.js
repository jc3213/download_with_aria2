const aria2 = (() => {
    let url = 'ws://localhost:6800/jsonrpc';
    let secret = '';
    let socket = null;
    let id = 0;
    let tries = 0;
    let retries = 10;
    let timeout = 10000;
    let tick = 0;
    let pending = new Map();
    let onopen = null;
    let onmessage = null;
    let onclose = null;

    function open() {
        if (socket) {
            let readyState = socket.readyState;

            if (socket.url === url) {
                if (readyState === 0) {
                    throw new Error('WebSocket error: connection is still in CONNECTING state');
                }
                if (readyState === 1) {
                    return;
                }
            }

            socket.onopen = null;
            socket.onmessage = null;
            socket.onclose = null;
            socket.close();
        }

        socket = new WebSocket(url);

        socket.onopen = (event) => {
            tries = 0;

            if (onopen) {
                onopen(event);
            }
        };

        socket.onmessage = (event) => {
            let json = JSON.parse(event.data);
            let id = json.id;

            if (id !== undefined) {
                let session = pending.get(id);

                if (session) {
                    pending.delete(id);
                    session.resolve(json);
                }
            } else {
                if (onmessage) {
                    onmessage(json);
                }
            }
        };

        socket.onclose = (event) => {
            if (pending.size > 0) {
                for (let session of pending.values()) {
                    session.reject(new Error('WebSocket error: connection closed'));
                }

                pending.clear();
            }

            if (onclose) {
                onclose(event);
            }

            if (tries++ < retries) {
                tick = setTimeout(open, timeout);
            } else {
                tries = 0;
            }
        };
    }

    return {
        set url(string) {
            if (string.startsWith('http://') || string.startsWith('https://')) {
                url = 'ws' + string.substring(4);
            } else if (string.startsWith('ws://') || string.startsWith('wss://')) {
                url = string;
            } else {
                throw new TypeError('Invalid URL: expected a valid ws(s):// URL');
            }
        },
        get url() {
            return url;
        },

        set secret(string) {
            secret = 'token:' + string;
        },
        get secret() {
            return secret.substring(6);
        },

        set retries(number) {
            let n = number | 0;

            if (n < 0) {
                retries = Infinity;
            } else {
                retries = n;
            }
        },
        get retries() {
            return retries;
        },

        set timeout(number) {
            let n = number | 0;

            if (n > 1) {
                timeout = n * 1000;
            } else {
                timeout = 1000;
            }
        },
        get timeout() {
            return timeout / 1000;
        },

        get ready() {
            if (!socket) {
                return false;
            }

            return socket.readyState === WebSocket.OPEN;
        },

        set onopen(callback) {
            if (typeof callback === 'function') {
                onopen = callback;
            } else {
                onopen = null;
            }
        },
        get onopen() {
            return onopen;
        },

        set onmessage(callback) {
            if (typeof callback === 'function') {
                onmessage = callback;
            } else {
                onmessage = null;
            }
        },
        get onmessage() {
            return onmessage;
        },

        set onclose(callback) {
            if (typeof callback === 'function') {
                onclose = callback;
            } else {
                onclose = null;
            }
        },
        get onclose() {
            return onclose;
        },

        send(json) {
            return new Promise((resolve, reject) => {
                if (socket.readyState !== WebSocket.OPEN) {
                    throw new Error('WebSocket error: failed to send message');
                }

                pending.set(json.id, { resolve, reject });
                socket.send(JSON.stringify(json));
            });
        },

        call(method, params) {
            if (params) {
                params = [secret].concat(params);
            } else {
                params = [secret];
            }

            return this.send({ jsonrpc: '2.0', id: id++, method, params });
        },

        multicall(args) {
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

            return this.send({ jsonrpc: '2.0', id: id++, method: 'system.multicall', params: [calls] });
        },

        connect() {
            clearTimeout(tick);
            tries = 0;
            open();
        },

        disconnect() {
            clearTimeout(tick);
            tries = Infinity;

            if (socket.readyState === WebSocket.OPEN) {
                socket.close();
            }
        }
    };
})();
