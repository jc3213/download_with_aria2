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

    constructor(url = 'http://localhost:6800/jsonrpc', secret = '') {
        let rpc = url.split('#');
        this.url = rpc[0];
        this.secret = rpc[1] ?? secret;
        this.call = this.#post;
    }

    set url(string) {
        if (string.startsWith('http://') || string.startsWith('https://')) {
            this.#url = this.#xml = string;
            this.#wsa = string.replace('http', 'ws');
        } else if (string.startsWith('ws://') || string.startsWith('wss://')) {
            this.#xml = string.replace('ws', 'http');
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
        this.#retries = n >= 0 ? n : Infinity;
    }
    get retries() {
        return this.#retries;
    }

    set timeout(number) {
        let n = number | 0;
        this.#timeout = n <= 1 ? 1000 : n * 1000;
    }
    get timeout() {
        return this.#timeout / 1000;
    }

    set onopen(callback) {
        this.#onopen = typeof callback === 'function' ? callback : null;
    }
    get onopen() {
        return this.#onopen;
    }

    set onmessage(callback) {
        this.#onmessage = typeof callback === 'function' ? callback : null;
    }
    get onmessage() {
        return this.#onmessage;
    }

    set onclose(callback) {
        this.#onclose = typeof callback === 'function' ? callback : null;
    }
    get onclose() {
        return this.#onclose;
    }

    #json(args) {
        if (Array.isArray(args)) {
            let calls = [];
            for (let { method, params = [] } of args) {
                params.unshift(this.#secret);
                calls.push({ methodName: method, params });
            }
            args = { method: 'system.multicall', params: [calls] };
        } else {
            (args.params ??= []).unshift(this.#secret);
        }
        args.jsonrpc = '2.0';
        args.id = this.#id++;
        return args;
    }

    #send(args) {
        return new Promise((resolve, reject) => {
            let json = this.#json(args);
            this[json.id] = resolve;
            this.#socket.onerror = reject;
            this.#socket.send(JSON.stringify(json));
        });
    }

    #post(args) {
        return fetch(this.#xml, { method: 'POST', body: JSON.stringify(this.#json(args)) }).then((response) => {
            if (response.ok) {
                return response.json();
            }
            throw new Error('Network error: ' + response.status + ' ' + response.statusText);
        });
    }

    connect() {
        this.#socket = new WebSocket(this.#wsa);
        this.#socket.onopen = (event) => {
            this.call = this.#send;
            this.#tries = 0;
            this.#onopen?.(event);
        };
        this.#socket.onmessage = (event) => {
            let json = JSON.parse(event.data);
            if (json.method) {
                this.#onmessage?.(json);
            } else {
                let { id } = json;
                this[id](json);
                delete this[id];
            }
        };
        this.#socket.onclose = (event) => {
            this.call = this.#post;
            this.#onclose?.(event);
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
