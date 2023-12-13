class Aria2 {
    constructor (url, secret) {
        const [protocol, http, socket] = url.match(/(https?)|(wss?)|([^:]+)/);
        this.post = http ? this.fetch : socket ? this.websocket : this.handle({error: new Error(`Invalid protocol: "${protocol}" is not supported.`)});
        this.jsonrpc = url;
        this.secret = `token:${secret}`;
    }
    call (method, ...options) {
        const json = {id: '', jsonrpc: '2.0', method, params: [this.secret, ...options]};
        return this.post(JSON.stringify(json)).then(this.handle);
    }
    batch (array) {
        const json = array.map(([method, ...options]) => ({id: '', jsonrpc: '2.0', method, params: [this.secret, ...options]}));
        return this.post(JSON.stringify(json)).then((response) => response.map(this.handle));
    }
    handle ({result, error}) {
        if (result) {
            return result;
        }
        throw error;
    }
    fetch (body) {
        return fetch(this.jsonrpc, {method: 'POST', body}).then((response) => {
            if (response.ok) {
                return response.json();
            }
            throw new Error(response.statusText);
        });
    }
    websocket (message) {
        return new Promise((resolve, reject) => {
            const socket = new WebSocket(this.jsonrpc);
            socket.onopen = (event) => socket.send(message);
            socket.onclose = reject;
            socket.onmessage = (event) => {
                socket.close();
                resolve(JSON.parse(event.data));
            };
        });
    }
}
