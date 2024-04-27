class Aria2 {
    constructor (...args) {
        let path = args.join('#').match(/^(https?|wss?)(?:#|:\/\/)([^#]+)#?(.*)$/);
        if (!path) { throw new Error('Invalid JSON-RPC entry: "' + args.join('", "') + '"'); }
        this.scheme = path[1];
        this.url = path[2];
        this.secret = path[3];
    }
    set scheme (scheme) {
        this.call = { 'http': this.post, 'https': this.post, 'ws': this.send, 'wss': this.send }[ scheme ];
        if (!this.call) { throw new Error('Invalid JSON-RPC scheme: "' + scheme + '" is not supported!'); }
        this._scheme = scheme;
        this._jsonrpc = scheme + '://' + this._url;
    }
    get scheme () {
        return this._scheme;
    }
    set url (url) {
        if (this._url === url) { return; }
        this._url = url;
        this._jsonrpc = this._scheme + '://' + url;
        this.connect();
    }
    get url () {
        return this._url;
    }
    set secret (secret) {
        this._secret = 'token:' + secret;
    }
    get secret () {
        return this._secret;
    }
    connect () {
        this.socket?.then( (ws) => ws.close() );
        this.socket = new Promise((resolve, reject) => {
            let ws = new WebSocket(this._jsonrpc.replace('http', 'ws'));
            ws.onopen = (event) => {
                if (typeof this._onmessage === 'function') { ws.addEventListener('message', (event) => this._onmessage(JSON.parse(event.data))); }
                if (typeof this._onclose === 'function') { ws.addEventListener('close', this._onclose); }
                resolve(ws);
            }
            ws.onerror = (error) => reject(error);
        });
    }
    set onmessage (callback) {
        if (typeof callback !== 'function') { return; }
        if (!this._onmessage) { this.socket.then( (ws) => ws.addEventListener('message', (event) => this._onmessage(JSON.parse(event.data))) ); }
        this._onmessage = callback;
    }
    get onmessage () {
        return this._onmessage;
    }
    set onclose (callback) {
        if (typeof callback !== 'function') { return; }
        if (!this._onclose) { this.socket.then( (ws) => ws.addEventListener('close', this._onclose) ); }
        this._onclose = callback;
    }
    get onclose () {
        return this._onclose;
    }
    send (...messages) {
        return this.socket.then((ws) => new Promise((resolve, reject) => {
            ws.onmessage = (event) => resolve(JSON.parse(event.data));
            ws.onerror = (error) => reject(error);
            ws.send(this.json(messages));
        }));
    }
    post (...messages) {
        return fetch(this._jsonrpc, {method: 'POST', body: this.json(messages)}).then((response) => {
            if (response.ok) { return response.json(); }
            throw new Error(response.statusText);
        });
    }
    json (array) {
        let json = array.map( ({method, params = []}) => ({ id: '', jsonrpc: '2.0', method, params: [this._secret, ...params] }) );
        return JSON.stringify(json);
    }
}
