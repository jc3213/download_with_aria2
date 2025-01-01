class Aria2 {
    constructor (...args) {
        let path = args.join('#').match(/^(https?|wss?)(?:#|:\/\/)([^#]+)#?(.*)$/);
        if (!path) { throw new Error('Invalid JSON-RPC entry: "' + args.join('", "') + '"'); }
        this.scheme = path[1];
        this.url = path[2];
        this.secret = path[3];
    }
    version = '0.8.0';
    jsonrpc = { retries: 10, timeout: 10000 };
    events = { onopen: null, onmessage: null, onclose: null };
    set scheme (scheme) {
        this.call = { 'http': this.post, 'https': this.post, 'ws': this.send, 'wss': this.send }[ scheme ];
        if (!this.call) { throw new Error('Unsupported JSON-RPC scheme: "' + scheme + '"'); }
        this.jsonrpc.scheme = scheme;
        this.jsonrpc.path = scheme + '://' + this.jsonrpc.url;
    }
    get scheme () {
        return this.jsonrpc.scheme;
    }
    set url (url) {
        if (this.jsonrpc.url === url) { return; }
        this.jsonrpc.url = url;
        this.jsonrpc.path = this.jsonrpc.scheme + '://' + url;
        this.jsonrpc.ws = this.jsonrpc.path.replace('http', 'ws');
        this.jsonrpc.count = 0;
        this.disconnect();
        this.connect();
    }
    get url () {
        return this.jsonrpc.url;
    }
    set secret (secret) {
        this.jsonrpc.secret = secret;
        this.jsonrpc.params = secret ? ['token:' + secret] : [];
    }
    get secret () {
        return this.jsonrpc.secret;
    }
    set retries (number) {
        this.jsonrpc.retries = isNaN(number) || number < 0 ? Infinity : number;
    }
    get retries () {
        return isNaN(this.jsonrpc.retries) ? Infinity : this.jsonrpc.retries;
    }
    set timeout (number) {
        this.jsonrpc.time = isNaN(number) ? 10 : number | 0;
        this.jsonrpc.timeout = this.jsonrpc.time * 1000;
    }
    get timeout () {
        return isNaN(this.jsonrpc.time) ? 10 : this.jsonrpc.time | 0;
    }
    connect () {
        this.socket = new WebSocket(this.jsonrpc.ws);
        this.socket.onopen = (event) => {
            this.alive = true;
            if (typeof this.events.onopen === 'function') { this.events.onopen(event); }
        };
        this.socket.onmessage = (event) => {
            let response = JSON.parse(event.data);
            if (!response.method) { this.socket.resolve(response); }
            else if (typeof this.events.onmessage === 'function') { this.events.onmessage(response); }
        };
        this.socket.onclose = (event) => {
            this.alive = false;
            if (!event.wasClean && this.jsonrpc.count < this.jsonrpc.retries) { setTimeout(() => this.connect(), this.jsonrpc.timeout); }
            if (typeof this.events.onclose === 'function') { this.events.onclose(event); }
            this.jsonrpc.count ++;
        };
    }
    disconnect () {
        this.socket?.close();
    }
    set onopen (callback) {
        this.events.onopen = typeof callback === 'function' ? callback : null;
    }
    get onopen () {
        return typeof this.events.onopen === 'function' ? this.events.onopen : null;
    }
    set onmessage (callback) {
        this.events.onmessage = typeof callback === 'function' ? callback : null;
    }
    get onmessage () {
        return typeof this.events.onmessage === 'function' ? this.events.onmessage : null;
    }
    set onclose (callback) {
        this.events.onclose = typeof callback === 'function' ? callback : null;
    }
    get onclose () {
        return typeof this.events.onclose === 'function' ? this.events.onclose : null;
    }
    send (...args) {
        return new Promise((resolve, reject) => {
            this.socket.resolve = resolve;
            this.socket.onerror = reject;
            this.socket.send(this.json(args));
        });
    }
    post (...args) {
        return fetch(this.jsonrpc.path, {method: 'POST', body: this.json(args)}).then((response) => {
            if (response.ok) { return response.json(); }
            throw new Error(response.statusText);
        });
    }
    json (args) {
        let json = args.map( ({ method, params = [] }) => ({ id: '', jsonrpc: '2.0', method, params: [...this.jsonrpc.params, ...params] }) );
        return JSON.stringify(json);
    }
}
