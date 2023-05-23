class Aria2 {
    constructor (url, secret) {
        var [protocol, http, socket] = url.match(/(^http)s?|^(ws)s?|^([^:]+)/);
        this.post = http ? this.fetch : socket ? this.websocket : this.error(protocol);
        this.jsonrpc = url;
        this.params = secret ? [`token:${secret}`] : [];
    }
    error (protocol) {
        throw new Error(`Invalid protocol: "${protocol}" is not supported.`);
    }
    message (method, options) {
        var params = Array.isArray(options) ? [...this.params, ...options] : [...this.params];
        return {id: '', jsonrpc: '2.0', method, params};
    }
    call (method, options) {
        var json = this.message(method, options);
        var message = JSON.stringify(json);
        return this.post(message).then(({result, error}) => {
            if (result) {
                return result;
            }
            throw error;
        });
    }
    batch (array) {
        var json = array.map(({method, params}) => this.message(method, params));
        var message = JSON.stringify(json);
        return this.post(message).then((response) => {
            return response.map(({result, error}) => {
                if (result) {
                    return result;
                }
                throw error;
            });
        });
    }
    fetch (body) {
        return fetch(this.jsonrpc, {method: 'POST', body})
            .then((response) => {
                if (response.ok) {
                    return response.json();
                }
                throw new Error(response.statusText);
            });
    }
    websocket (message) {
        return new Promise((resolve, reject) => {
            var socket = new WebSocket(this.jsonrpc);
            socket.onopen = (event) => socket.send(message);
            socket.onclose = reject;
            socket.onmessage = (event) => {
                socket.close();
                var json = JSON.parse(event.data);
                resolve(json);
            };
        });
    }
}
