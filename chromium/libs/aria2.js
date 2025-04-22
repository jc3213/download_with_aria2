class Aria2 {
    constructor (...args) {
        let path = args.join('#').match(/^(https?|wss?)(?:#|:\/\/)([^#]+)#?(.*)$/);
        if (!path) { throw new Error('Unsupported parameters: "' + args.join('", "') + '"'); }
        this.scheme = path[1];
        this.url = path[2];
        this.secret = path[3];
    }
    version = '1.0';
    #args = { retries: 10, timeout: 10000 };
    set scheme (scheme) {
        let type = scheme.match(/^(http|ws)(s)?$/);
        if (!type) { throw new Error('Unsupported scheme: "' + scheme + '"'); }
        this.#args.scheme = scheme;
        this.method = type[1];
        this.ssl = type[2];
    }
    get scheme () {
        return this.#args.scheme;
    }
    set method (method) {
        if (!/^(http|ws)$/.test(method)) { throw new Error('Unsupported method: "' + method + '"'); }
        this.#args.method = method;
        this.call = this[method];
    }
    get method () {
        return this.#args.method;
    }
    set ssl (ssl) {
        this.#args.ssl = ssl ? 's' : '';
        this.path();
    }
    get ssl () {
        return !!this.#args.ssl;
    }
    set url (url) {
        this.#args.url = url;
        this.path();
    }
    get url () {
        return this.#args.url;
    }
    set secret (secret) {
        this.#args.token = 'token:'　+ secret;
    }
    get secret () {
        return this.#args.token.slice(6);
    }
    set retries (number) {
        this.#args.retries = isNaN(number) || number < 0 ? Infinity : number;
    }
    get retries () {
        return this.#args.retries;
    }
    set timeout (number) {
        this.#args.timeout = isNaN(number) ? 10000 : number * 1000;
    }
    get timeout () {
        return this.#args.timeout / 1000;
    }
    set onopen (func) {
        this.#args.onopen = typeof func === 'function' ? func : null;
    }
    get onopen () {
        return this.#args.onopen ?? null;
    }
    set onmessage (func) {
        this.#args.onmessage = typeof func === 'function' ? func : null;
    }
    get onmessage () {
        return this.#args.onmessage ?? null;
    }
    set onclose (func) {
        this.#args.onclose = typeof func === 'function' ? func : null;
    }
    get onclose () {
        return this.#args.onclose ?? null;
    }
    path () {
        let {ssl, url} = this.#args;
        this.#args.xml = 'http' + ssl + '://' + url;
        this.#args.ws = 'ws' + ssl + '://' + url;
    }
    connect () {
        let tries = 0;
        this.socket = new WebSocket(this.#args.ws);
        this.socket.onopen = (event) => {
            this.alive = true;
            if (this.#args.onopen) { this.#args.onopen(event); }
        };
        this.socket.onmessage = (event) => {
            let response = JSON.parse(event.data);
            if (!response.method) { this.#args.onresponse(response); }
            else if (this.#args.onmessage) { this.#args.onmessage(response); }
        };
        this.socket.onclose = (event) => {
            this.alive = false;
            if (!event.wasClean && tries ++ < this.#args.retries) { setTimeout(() => this.connect(), this.#args.timeout); }
            if (this.#args.onclose) { this.#args.onclose(event); }
        };
    }
    disconnect () {
        this.socket.close();
    }
    ws (...args) {
        return new Promise((resolve, reject) => {
            this.#args.onresponse = resolve;
            this.socket.onerror = reject;
            this.socket.send(this.json(args));
        });
    }
    http (...args) {
        return fetch(this.#args.xml, {method: 'POST', body: this.json(args)}).then((response) => {
            if (response.ok) { return response.json(); }
            throw new Error(response.statusText);
        });
    }
    json (args) {
        let json = args.map( ({ method, params = [] }) => ({ id: '', jsonrpc: '2.0', method, params: [this.#args.token, ...params] }) );
        return JSON.stringify(json);
    }
}
