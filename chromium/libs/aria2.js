class Aria2 {
    constructor(jsonrpc, secret) {
        this.jsonrpc = jsonrpc;
        this.secret = secret;
        this.sender = jsonrpc.startsWith('http') ? this.http : this.socket;
    }
    http (body) {
        return new Promise((resolve, reject) => {
            fetch(this.jsonrpc, {method: 'POST', body})
            .then(response => response.json())
            .then(({result, error}) => result ? resolve(result) : reject())
            .catch(reject);
        });
    }
    socket (message) {
        return new Promise((resolve, reject) => {
            var socket = new WebSocket(this.jsonrpc);
            socket.onopen = event => socket.send(message);
            socket.onclose = reject;
            socket.onmessage = event => {
                var {result, error} = JSON.parse(event.data);
                result ? resolve(result) : reject();
                socket.close();
            };
        });
    }
    message (method, params = []) {
        var message = JSON.stringify({id: '', jsonrpc: 2, method, params: [this.secret, ...params]});
        return this.sender(message);
    }
    indicator (callback) {
        this.message('aria2.tellActive').then(result => {
            var active = result.map(({gid}) => gid);
            callback(active.length + '');
            this.alert = new WebSocket(this.jsonrpc.replace('http', 'ws'));
            this.alert.onmessage = event => {
                var {method, params: [{gid}]} = JSON.parse(event.data);
                var index = active.indexOf(gid);
                method === 'aria2.onDownloadStart' ? index === -1 && active.push(gid) :
                    method !=='aria2.onBtDownloadComplete' && index !== -1 && active.splice(index, 1);
                callback(active.length + '');
            };
        }).catch(error => callback('E'));
    }
    manager (resolve, reject, interval) {
        var message = JSON.stringify({
            id: '', jsonrpc: 2, method: 'system.multicall', params: [[
                {methodName: 'aria2.getGlobalStat', params: [this.secret]}, {methodName: 'aria2.tellActive', params: [this.secret]},
                {methodName: 'aria2.tellWaiting', params: [this.secret, 0, 99]}, {methodName: 'aria2.tellStopped', params: [this.secret, 0, 99]}
            ]]
        });
        this.sender(message).then(resolve).catch(reject);
        this.alive = setInterval(() => this.sender(message).then(resolve).catch(reject), interval);
    }
    terminate () {
        this.alert && this.alert.readyState === 1 && this.alert.close();
        this.alive && clearInterval(this.alive);
    }
}
