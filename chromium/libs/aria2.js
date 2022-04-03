class Aria2 {
    constructor (jsonrpc, secret) {
        this.jsonrpc = jsonrpc;
        this.secret = secret;
    }
    get methods () {
        return ['aria2.addUri', 'aria2.addTorrent', 'aria2.addMetalink', 'aria2.remove', 'aria2.forceRemove', 'aria2.pause', 'aria2.pauseAll', 'aria2.forcePause', 'aria2.forcePauseAll', 'aria2.unpause', 'aria2.unpauseAll', 'aria2.tellStatus', 'aria2.getUris', 'aria2.getFiles', 'aria2.getPeers', 'aria2.getServers', 'aria2.tellActive', 'aria2.tellWaiting', 'aria2.tellStopped', 'aria2.changePosition', 'aria2.changeUri', 'aria2.getOption', 'aria2.changeOption', 'aria2.getGlobalOption', 'aria2.changeGlobalOption', 'aria2.getGlobalStat', 'aria2.purgeDownloadResult', 'aria2.removeDownloadResult', 'aria2.getVersion', 'aria2.getSessionInfo', 'aria2.shutdown', 'aria2.forceShutdown', 'aria2.saveSession', 'system.multicall', 'system.listMethods', 'system.listNotifications'];
    }
    get notifications () {
        return ['aria2.onDownloadStart', 'aria2.onDownloadPause', 'aria2.onDownloadStop', 'aria2.onDownloadComplete', 'aria2.onDownloadError', 'aria2.onBtDownloadComplete'];
    }
    set jsonrpc (jsonrpc) {
        let sender = jsonrpc.startsWith('http') ? body => new Promise((resolve, reject) => {
            fetch(jsonrpc, {method: 'POST', body})
            .then(response => response.json())
            .then(({result, error}) => result ? resolve(result) : reject())
            .catch(reject);
        }) : message => new Promise((resolve, reject) => {
            var socket = new WebSocket(jsonrpc);
            socket.onopen = event => socket.send(message);
            socket.onclose = reject;
            socket.onmessage = event => {
                var {result, error} = JSON.parse(event.data);
                result ? resolve(result) : reject();
                socket.close();
            };
        });
        this.message = (method, params) => {
            var message = {...this.json, method};
            message.params = message.params.concat(params ?? []);
            return sender(JSON.stringify(message));
        }
    }
    set secret (secret) {
        this.json = {id: '', jsonrpc: '2.0', params: []}
        if (secret) {
            this.json.params.push('token:' + secret);
        }
    }
}
