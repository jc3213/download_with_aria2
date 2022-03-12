class Aria2 {
    constructor (jsonrpc, secret) {
        this.jsonrpc = jsonrpc;
        this.secret = 'token:' + secret;
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
    indicator (onchange) {
        this.message('aria2.tellActive').then(result => {
            var active = result.map(({gid}) => gid);
            onchange(active.length);
            this.route = new WebSocket(this.jsonrpc.replace('http', 'ws'));
            this.route.onmessage = event => {
                var {method, params: [{gid}]} = JSON.parse(event.data);
                var index = active.indexOf(gid);
                method === 'aria2.onDownloadStart' ? index === -1 && active.push(gid) :
                    method !== 'aria2.onBtDownloadComplete' ? index !== -1 && active.splice(index, 1) : null;
                onchange(active.length);
            };
        }).catch(error => onchange('E'));
    }
    manager (onactive, onstopped, onmessage, onerror, interval) {
        this.message('aria2.getGlobalStat').then(async ({numWaiting, numStopped}) => {
            onactive(await this.message('aria2.tellActive'));
            onstopped(await this.message('aria2.tellWaiting', [0, numWaiting | 0]), await this.message('aria2.tellStopped', [0, numStopped | 0]));
            this.route = new WebSocket(this.jsonrpc.replace('http', 'ws'));
            this.route.onmessage = async event => {
                var {method, params: [{gid}]} = JSON.parse(event.data);
                onmessage(method, gid, await this.message('aria2.tellStatus', [gid]));
            };
            this.alive = setInterval(async () => onactive(await this.message('aria2.tellActive')), interval);
        }).catch(onerror);
    }
    terminate () {
        this.route && this.route.readyState === 1 && this.route.close();
        this.alive && clearInterval(this.alive);
    }
}
