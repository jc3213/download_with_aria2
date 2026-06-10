class Aria2 {
    #url;
    #xml;
    #wsa;
    #secret;
    #socket;
    #id = 0;
    #tries = 0;
    #retries = 10;
    #timeout = 10000;
    #onopen = null;
    #onmessage = null;
    #onclose = null;
    #call;

    constructor(url, secret) {
        if (!url) {
            this.url = 'http://localhost:6800/jsonrpc';
            this.secret = '';
        } else {
            let i = url.indexOf('#');
            if (i !== -1) {
                this.url = url.slice(0, i);
                this.secret = url.slice(i + 1);
            } else {
                this.url = url;
                this.secret = secret || '';
            }
        }
        this.#call = this.#post;
    }

    set url(string) {
        if (string.startsWith('http://') || string.startsWith('https://')) {
            this.#url = this.#xml = string;
            this.#wsa = 'ws' + string.substring(4);
        } else if (string.startsWith('ws://') || string.startsWith('wss://')) {
            this.#xml = 'http' + string.substring(2);
            this.#url = this.#wsa = string;
        } else {
            throw new TypeError('Invalid JSON-RPC Endpoint: expected http(s):// or ws(s)://');
        }
    }
    get url() {
        return this.#url;
    }

    set secret(string) {
        this.#secret = 'token:' + string;
    }
    get secret() {
        return this.#secret.substring(6);
    }

    set retries(number) {
        let n = number | 0;
        if (n >= 0) {
            this.#retries = n;
        } else {
            this.#retries = Infinity;
        }
    }
    get retries() {
        return this.#retries;
    }

    set timeout(number) {
        let n = number | 0;
        if (n <= 1) {
            this.#timeout = 1000;
        } else {
            this.#timeout = n * 1000;
        }
    }
    get timeout() {
        return this.#timeout / 1000;
    }

    set onopen(callback) {
        if (typeof callback === 'function') {
            this.#onopen = callback;
        } else {
            this.#onopen = null;
        }
    }
    get onopen() {
        return this.#onopen;
    }

    set onmessage(callback) {
        if (typeof callback === 'function') {
            this.#onmessage = callback;
        } else {
            this.#onmessage = null;
        }
    }
    get onmessage() {
        return this.#onmessage;
    }

    set onclose(callback) {
        if (typeof callback === 'function') {
            this.#onclose = callback;
        } else {
            this.#onclose = null;
        }
    }
    get onclose() {
        return this.#onclose;
    }

    #send(json) {
        return new Promise((resolve, reject) => {
            this[json.id] = resolve;
            this.#socket.onerror = reject;
            this.#socket.send(JSON.stringify(json));
        });
    }

    #post(json) {
        return fetch(this.#xml, { method: 'POST', body: JSON.stringify(json) }).then((response) => {
            if (response.ok) {
                return response.json();
            }
            throw new Error('Network error: ' + response.status + ' ' + response.statusText);
        });
    }

    call(method, params) {
        if (params) {
            params = [this.#secret].concat(params);
        } else {
            params = [this.#secret];
        }
        return this.#call({ jsonrpc: '2.0', id: this.#id++, method, params });
    }

    multicall(args) {
        let calls = [];
        for (let i = 0, l = args.length; i < l; i++) {
            let arg = args[i];
            let params = arg.params;
            if (params) {
                params = [this.#secret].concat(params);
            } else {
                params = [this.#secret];
            }
            calls[i] = { methodName: arg.methodName, params };
        }
        return this.#call({ jsonrpc: '2.0', id: this.#id++, method: 'system.multicall', params: [calls] });
    }

    connect() {
        this.#socket = new WebSocket(this.#wsa);
        this.#socket.onopen = (event) => {
            this.#call = this.#send;
            this.#tries = 0;
            if (this.#onopen) {
                this.#onopen(event);
            }
        };
        this.#socket.onmessage = (event) => {
            let json = JSON.parse(event.data);
            if (json.method) {
                if (this.#onmessage) {
                    this.#onmessage(json);
                }
            } else {
                let id = json.id;
                this[id](json);
                delete this[id];
            }
        };
        this.#socket.onclose = (event) => {
            this.#call = this.#post;
            if (this.#onclose) {
                this.#onclose(event);
            }
            if (this.#tries++ < this.#retries) {
                setTimeout(() => this.connect(), this.#timeout);
            } else {
                this.#tries = 0;
            }
        };
    }

    disconnect() {
        this.#tries = Infinity;
        this.#socket.close();
    }
}
