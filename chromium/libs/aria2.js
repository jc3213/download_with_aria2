class Aria2 {
    constructor (scheme, url, secret) {
        this.scheme = scheme;
        this.url = url;
        this.secret = secret;
    }
    set scheme (scheme) {
        const methods = { 'http': this.post, 'https': this.post, 'ws': this.send, 'wss': this.send };
        this.call = methods[scheme];
        if (this.call === undefined) { throw new Error('Invalid method: ' + scheme + ' is not supported!'); }
        this._scheme = scheme;
        this._jsonrpc = scheme + '://' + this._url;
    }
    get scheme () {
        return this._scheme;
    }
    set url (url) {
        if (this._url === url) { return; }
        this._url = url;
        this.jsonrpc = this._scheme + '://' + url;
    }
    get url () {
        return this._url;
    }
    set jsonrpc (jsonrpc) {
        this._jsonrpc = jsonrpc;
        this._onmessage = null;
        if (this.websocket === undefined) { return this.connect(); }
        this.disconnect().then( (event) => this.connect() );
    }
    get jsonrpc () {
        return this._jsonrpc;
    }
    set secret (secret) {
        this._secret = 'token:' + secret;
    }
    get secret () {
        return this._secret;
    }
    connect () {
        this.websocket = new Promise((resolve, reject) => {
            const websocket = new WebSocket(this._jsonrpc.replace('http', 'ws'));
            websocket.onopen = (event) => resolve(websocket);
            websocket.onerror = (error) => reject(error);
        });
    }
    disconnect () {
        return this.websocket.then((websocket) => new Promise((resolve, reject) => {
            websocket.onclose = (event) => resolve(event);
            websocket.onerror = (error) => reject(error);
            websocket.close();
        }));
    }
    set onmessage (callback) {
        if (typeof callback !== 'function') { return; }
        if (this._onmessage === null) { this.websocket.then( (websocket) => websocket.addEventListener('message', (event) => this._onmessage(JSON.parse(event.data))) ); }
        this._onmessage = callback;
    }
    get onmessage () {
        return this._onmessage;
    }
    send (...messages) {
        return this.websocket.then((websocket) => new Promise((resolve, reject) => {
            websocket.onmessage = (event) => resolve(JSON.parse(event.data));
            websocket.onerror = (error) => reject(error);
            websocket.send(this.json(messages));
        }));
    }
    post (...messages) {
        return fetch(this._jsonrpc, {method: 'POST', body: this.json(messages)}).then((response) => {
            if (response.ok) { return response.json(); }
            throw new Error(response.statusText);
        });
    }
    json (array) {
        const json = array.map( ({method, params = []}) => ({ id: '', jsonrpc: '2.0', method, params: [this._secret, ...params] }) );
        return JSON.stringify(json);
    }
}
