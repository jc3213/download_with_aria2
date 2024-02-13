class Aria2 {
    constructor (scheme, url, secret) {
        this.url = url;
        this.secret = 'token:' + secret;
        this.method = scheme;
        this.connect();
    }
    set method (scheme) {
        const methods = { 'http': this.post, 'https': this.post, 'ws': this.send, 'wss': this.send };
        this.jsonrpc = scheme + '://' + this.url;
        if (!(this.call = methods[scheme])) { throw new Error('Invalid method: ' + scheme + ' is not supported!'); }
    }
    connect () {
        this.websocket = new Promise((resolve, reject) => {
            const websocket = new WebSocket(this.jsonrpc.replace('http', 'ws'));
            websocket.onopen = (event) => resolve(websocket);
            websocket.onerror = (error) => reject(error);
        });
    }
    disconnect () {
        this.websocket.then( (websocket) => websocket.close() );
    }
    set onmessage (callback) {
        this.websocket.then( (websocket) => websocket.addEventListener('message', (event) => callback(JSON.parse(event.data))) );
    }
    json (array) {
        const json = array.map( ({method, params = []}) => ({ id: '', jsonrpc: '2.0', method, params: [this.secret, ...params] }) );
        return JSON.stringify(json);
    }
    send (...messages) {
        return new Promise((resolve, reject) => {
            this.websocket.then((websocket) => {
                websocket.onmessage = (event) => resolve(JSON.parse(event.data));
                websocket.onerror = (error) => reject(error);
                websocket.send(this.json(messages));
            });
        });
    }
    post (...messages) {
        return fetch(this.jsonrpc, {method: 'POST', body: this.json(messages)}).then((response) => {
            if (response.ok) { return response.json(); }
            throw new Error(response.statusText);
        });
    }
}
