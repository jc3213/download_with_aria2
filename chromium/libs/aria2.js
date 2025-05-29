class Aria2 {
    constructor (...args) {
        let path = args.join('#').match(/^(https?|wss?)(?:#|:\/\/)([^#]+)#?(.*)$/);
        if (!path) { throw new Error(`Unsupported parameters: "${args.join('", "')}"`); }
        this.scheme = path[1];
        this.url = path[2];
        this.secret = path[3];
    }
    version = '1.0';
    #xml;
    #wsa;
    #tries;
    #path () {
        this.#xml = `http${this.#ssl}://${this.#url}`;
        this.#wsa = `ws${this.#ssl}://${this.#url}`;
        this.#tries = 0;
    }
    #scheme;
    #ssl;
    set scheme (scheme) {
        let method = scheme.match(/^(http|ws)(s)?$/);
        if (!method) { throw new Error(`Unsupported scheme: "${scheme}"`); }
        this.#scheme = scheme;
        this.#ssl = method[2] ?? '';
        this.call = method[1] === 'http' ? this.#post : this.#send;
        this.#path();
    }
    get scheme () {
        return this.#scheme;
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
    #send (...args) {
        return new Promise((resolve, reject) => {
            let {id, body} = this.#json(args);
            this[id] = resolve;
            this.#ws.onerror = reject;
            this.#ws.send(body);
        });
    }
    #post (...args) {
        return fetch(this.#xml, {method: 'POST', body: this.#json(args).body}).then((response) => {
            if (response.ok) { return response.json(); }
            throw new Error(response.statusText);
        });
    }
    #json (args) {
        let id = `${Date.now()}`;
        let body = JSON.stringify( args.map( ({ method, params = [] }) => ({ id, jsonrpc: '2.0', method, params: [this.#secret, ...params] }) ) );
        return {id, body};
    }
    #ws;
    connect () {
        this.#ws = new WebSocket(this.#wsa);
        this.#ws.onopen = (event) => {
            if (this.#onopen) { this.#onopen(event); }
        };
        this.#ws.onmessage = (event) => {
            let response = JSON.parse(event.data);
            if (response.method) { if(this.#onmessage) { this.#onmessage(response); } }
            else { let {id} = response[0]; this[id](response); delete this[id]; }
        };
        this.#ws.onclose = (event) => {
            if (!event.wasClean && this.#tries++ < this.#retries) { setTimeout(() => this.connect(), this.#timeout); }
            if (this.#onclose) { this.#onclose(event); }
        };
    }
    disconnect () {
        this.#ws.close();
    }
}
