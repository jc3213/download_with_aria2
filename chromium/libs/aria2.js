class Aria2 {
    constructor (...args) {
        let path = args.join('#').match(/^(https?|wss?)(?:#|:\/\/)([^#]+)#?(.*)$/);
        if (!path) { throw new Error('Malformed JSON-RPC entry: "' + args.join('", "') + '"'); }
        this.scheme = path[1];
        this.url = path[2];
        this.secret = path[3];
    }
    version = '0.8.1';
    args = { retries: 10, timeout: 10000 };
    set scheme (scheme) {
        this.call = { 'http': this.post, 'https': this.post, 'ws': this.send, 'wss': this.send }[ scheme ];
        if (!this.call) { throw new Error('Unsupported JSON-RPC scheme: "' + scheme + '"'); }
        this.args.scheme = scheme;
        this.args.path = scheme + '://' + this.args.url;
    }
    get scheme () {
        return this.args.scheme;
    }
    set url (url) {
        if (this.args.url === url) { return; }
        this.args.url = url;
        this.args.path = this.args.scheme + '://' + url;
        this.args.ws = this.args.path.replace('http', 'ws');
        this.args.count = 0;
        this.disconnect();
        this.connect();
    }
    get url () {
        return this.args.url;
    }
    set secret (secret) {
        this.args.secret = secret;
        this.args.params = secret ? ['token:' + secret] : [];
    }
    get secret () {
        return this.args.secret;
    }
    set retries (number) {
        this.args.retries = isNaN(number) || number < 0 ? Infinity : number;
    }
    get retries () {
        return isNaN(this.args.retries) ? Infinity : this.args.retries;
    }
    set timeout (number) {
        this.args.time = isNaN(number) ? 10 : number | 0;
        this.args.timeout = this.args.time * 1000;
    }
    get timeout () {
        return isNaN(this.args.time) ? 10 : this.args.time | 0;
    }
    set onopen (callback) {
        this.args.onopen = typeof callback === 'function' ? callback : null;
    }
    get onopen () {
        return typeof this.args.onopen === 'function' ? this.args.onopen : null;
    }
    set onmessage (callback) {
        this.args.onmessage = typeof callback === 'function' ? callback : null;
    }
    get onmessage () {
        return typeof this.args.onmessage === 'function' ? this.args.onmessage : null;
    }
    set onclose (callback) {
        this.args.onclose = typeof callback === 'function' ? callback : null;
    }
    get onclose () {
        return typeof this.args.onclose === 'function' ? this.args.onclose : null;
    }
    connect () {
        this.socket = new WebSocket(this.args.ws);
        this.socket.onopen = (event) => {
            this.alive = true;
            if (typeof this.args.onopen === 'function') { this.args.onopen(event); }
        };
        this.socket.onmessage = (event) => {
            let response = JSON.parse(event.data);
            if (!response.method) { this.socket.resolve(response); }
            else if (typeof this.args.onmessage === 'function') { this.args.onmessage(response); }
        };
        this.socket.onclose = (event) => {
            this.alive = false;
            if (!event.wasClean && this.args.count < this.args.retries) { setTimeout(() => this.connect(), this.args.timeout); }
            if (typeof this.args.onclose === 'function') { this.args.onclose(event); }
            this.args.count ++;
        };
    }
    disconnect () {
        this.socket?.close();
    }
    send (...args) {
        return new Promise((resolve, reject) => {
            this.socket.resolve = resolve;
            this.socket.onerror = reject;
            this.socket.send(this.json(args));
        });
    }
    post (...args) {
        return fetch(this.args.path, {method: 'POST', body: this.json(args)}).then((response) => {
            if (response.ok) { return response.json(); }
            throw new Error(response.statusText);
        });
    }
    json (args) {
        let json = args.map( ({ method, params = [] }) => ({ id: '', jsonrpc: '2.0', method, params: [...this.args.params, ...params] }) );
        return JSON.stringify(json);
    }
}
