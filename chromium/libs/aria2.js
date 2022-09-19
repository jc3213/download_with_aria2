class JSLib_Aria2 {
    constructor (jsonrpc, secret) {
        if (jsonrpc.startsWith('http')) {
            var sender = this.fetch;
        }
        else if (jsonrpc.starsWith('ws')) {
            sender = this.websocket;
        }
        else {
            throw new Error('Invalid JSON RPC URI: Protocal not supported!');
        }
        this.message = function (method, options) {
            var params = [];
            if (secret) {
                params.push('token:' + secret);
            }
            if (options) {
                params.push(...options);
            }
            var message = JSON.stringify({id: '', jsonrpc: '2.0', method, params});
            return sender(jsonrpc, message);
        };
    }
    fetch (jsonrpc, body) {
        return fetch(jsonrpc, {method: 'POST', body}).then(function (response) {
            return response.json();
        }).then(function (json) {
            var {result, error} = json;
            if (result) {
                return result;
            }
            else {
                throw error;
            }
        });
    }
    websocket (jsonrpc, message) {
        return new Promise(function (resolve, reject) {
            var socket = new WebSocket(jsonrpc);
            socket.onopen = function (event) {
                socket.send(message);
            };
            socket.onclose = reject;
            socket.onmessage = function (event) {
                socket.close();
                var {result, error} = JSON.parse(event.data);
                if (result) {
                    resolve(result);
                }
                else {
                    reject(error);
                }
            };
        });
    }
}
