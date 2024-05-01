class Aria2 {
    constructor (...args) {
        let path = args.join('#').match(/^(https?|wss?)(?:#|:\/\/)([^#]+)#?(.*)$/);
        if (!path) { throw new Error('Invalid JSON-RPC entry: "' + args.join('", "') + '"'); }
        this.jsonrpc = {};
        this.scheme = path[1];
        this.url = path[2];
        this.secret = path[3];
    }
    set scheme (scheme) {
        this.call = { 'http': this.post, 'https': this.post, 'ws': this.send, 'wss': this.send }[ scheme ];
        if (!this.call) { throw new Error('Invalid JSON-RPC scheme: "' + scheme + '" is not supported!'); }
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
    connect () {
        this.socket?.then( (ws) => ws.close() );
        this.socket = new Promise((resolve, reject) => {
            let ws = new WebSocket(this.jsonrpc.ws);
            ws.onopen = (event) => resolve(ws);
            ws.onerror = reject;
            if (typeof this.jsonrpc.onmessage === 'function') { ws.addEventListener('message', (event) => this.jsonrpc.onmessage(JSON.parse(event.data))); }
            if (typeof this.jsonrpc.onclose === 'function') { ws.addEventListener('close', this.jsonrpc.onclose); }
        });
    }
    set onmessage (callback) {
        if (typeof callback !== 'function') { return; }
        if (!this.jsonrpc.onmessage) { this.socket.then( (ws) => ws.addEventListener('message', (event) => this.jsonrpc.onmessage(JSON.parse(event.data))) ); }
        this.jsonrpc.onmessage = callback;
    }
    get onmessage () {
        return this.jsonrpc.onmessage;
    }
    set onclose (callback) {
        if (typeof callback !== 'function') { return; }
        if (!this.jsonrpc.onclose) { this.socket.then( (ws) => ws.addEventListener('close', this.jsonrpc.onclose) ); }
        this.jsonrpc.onclose = callback;
    }
    get onclose () {
        return this.jsonrpc.onclose;
    }
    send (...messages) {
        return this.socket.then((ws) => new Promise((resolve, reject) => {
            ws.onmessage = (event) => resolve(JSON.parse(event.data));
            ws.onerror = reject;
            ws.send(this.json(messages));
        }));
    }
    post (...messages) {
        return fetch(this.jsonrpc.path, {method: 'POST', body: this.json(messages)}).then((response) => {
            if (response.ok) { return response.json(); }
            throw new Error(response.statusText);
        });
    }
    json (array) {
        let json = array.map( ({method, params = []}) => ({ id: '', jsonrpc: '2.0', method, params: [...this.jsonrpc.params, ...params] }) );
        return JSON.stringify(json);
    }
}
