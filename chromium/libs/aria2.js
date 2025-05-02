class Aria2 {
    constructor (...args) {
        let path = args.join('#').match(/^(https?|wss?)(?:#|:\/\/)([^#]+)#?(.*)$/);
        if (!path) { this.#error('parameters', args.join('", "')); }
        this.scheme = path[1];
        this.url = path[2];
        this.secret = path[3];
    }
    version = '1.0';
    #error (type, text) {
        throw new Error(`Unsupported ${type}: "${text}"`);
    }
    #alive;
    get alive () {
        return this.#alive;
    }
    set scheme (scheme) {
        let type = scheme.match(/^(http|ws)(s)?$/);
        if (!type) { this.#error('scheme', scheme); }
        this.method = type[1];
        this.ssl = type[2];
    }
    get scheme () {
        return this.#method + this.#ssl;
    }
    #method;
    set method (method) {
        this.call = method === "http" ? this.#post : method === "ws" ? this.#send : this.#error('method', method);
        this.#method = method;
    }
    get method () {
        return this.#method;
    }
    #ssl;
    set ssl (ssl) {
        this.#ssl = ssl ? 's' : '';
        this.#path();
    }
    get ssl () {
        return !!this.#ssl;
    }
    #url;
    set url (url) {
        this.#url = url;
        this.#path();
    }
    get url () {
        return this.#url;
    }
    #secret;
    set secret (secret) {
        this.#secret = `token:${secret}`;
    }
    get secret () {
        return this.#secret.slice(6);
    }
    #retries = 10;
    set retries (number) {
        this.#retries = isNaN(number) || number < 0 ? Infinity : number;
    }
    get retries () {
        return this.#retries;
    }
    #timeout = 10000;
    set timeout (number) {
        this.#timeout = isNaN(number) ? 10000 : number * 1000;
    }
    get timeout () {
        return this.#timeout / 1000;
    }
    #onopen = null;
    set onopen (func) {
        this.#onopen = typeof func === 'function' ? func : null;
    }
    get onopen () {
        return this.#onopen;
    }
    #onmessage = null;
    set onmessage (func) {
        this.#onmessage = typeof func === 'function' ? func : null;
    }
    get onmessage () {
        return this.#onmessage;
    }
    #onclose = null;
    set onclose (func) {
        this.#onclose = typeof func === 'function' ? func : null;
    }
    get onclose () {
        return this.#onclose;
    }
    #xml;
    #wsa;
    #tries;
    #path () {
        this.#xml = `http${this.#ssl}://${this.#url}`;
        this.#wsa = `ws${this.#ssl}://${this.#url}`;
        this.#tries = 0;
    }
    #onreceive = null;
    #send (...args) {
        return new Promise((resolve, reject) => {
            this.#onreceive = resolve;
            this.#ws.onerror = reject;
            this.#ws.send(this.#json(args));
        });
    }
    #post (...args) {
        return fetch(this.#xml, {method: 'POST', body: this.#json(args)}).then((response) => {
            if (response.ok) { return response.json(); }
            throw new Error(response.statusText);
        });
    }
    #json (args) {
        let json = args.map( ({ method, params = [] }) => ({ id: '', jsonrpc: '2.0', method, params: [this.#secret, ...params] }) );
        return JSON.stringify(json);
    }
    #ws;
    connect () {
        this.#ws = new WebSocket(this.#wsa);
        this.#ws.onopen = (event) => {
            this.#alive = true;
            if (this.#onopen) { this.#onopen(event); }
        };
        this.#ws.onmessage = (event) => {
            let response = JSON.parse(event.data);
            if (!response.method) { this.#onreceive(response); }
            else if (this.#onmessage) { this.#onmessage(response); }
        };
        this.#ws.onclose = (event) => {
            this.#alive = false;
            if (!event.wasClean && this.#tries++ < this.#retries) { setTimeout(() => this.connect(), this.#timeout); }
            if (this.#onclose) { this.#onclose(event); }
        };
    }
    disconnect () {
        this.#ws.close();
    }
}
