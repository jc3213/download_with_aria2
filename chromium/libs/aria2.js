class Aria2 {
    constructor (jsonrpc, secret) {
        let sender = jsonrpc.startsWith('http') ? body => new Promise((resolve, reject) => {
            fetch(this.jsonrpc, {method: 'POST', body})
            .then(response => response.json())
            .then(({result, error}) => result ? resolve(result) : reject())
            .catch(reject);
        }) : message => new Promise((resolve, reject) => {
            var socket = new WebSocket(this.jsonrpc);
            socket.onopen = event => socket.send(message);
            socket.onclose = reject;
            socket.onmessage = event => {
                var {result, error} = JSON.parse(event.data);
                result ? resolve(result) : reject();
                socket.close();
            };
        });
        this.jsonrpc = jsonrpc;
        this.secret = 'token:' + secret;
        this.message = (method, params) => {
            var message = JSON.stringify({id: '', jsonrpc: 2, method, params: [this.secret].concat(params ?? [])});
            return sender(message);
        }
    }
    methods = ['aria2.addUri', 'aria2.addTorrent', 'aria2.addMetalink', 'aria2.remove', 'aria2.forceRemove', 'aria2.pause', 'aria2.pauseAll', 'aria2.forcePause', 'aria2.forcePauseAll', 'aria2.unpause', 'aria2.unpauseAll', 'aria2.tellStatus', 'aria2.getUris', 'aria2.getFiles', 'aria2.getPeers', 'aria2.getServers', 'aria2.tellActive', 'aria2.tellWaiting', 'aria2.tellStopped', 'aria2.changePosition', 'aria2.changeUri', 'aria2.getOption', 'aria2.changeOption', 'aria2.getGlobalOption', 'aria2.changeGlobalOption', 'aria2.getGlobalStat', 'aria2.purgeDownloadResult', 'aria2.removeDownloadResult', 'aria2.getVersion', 'aria2.getSessionInfo', 'aria2.shutdown', 'aria2.forceShutdown', 'aria2.saveSession', 'system.multicall', 'system.listMethods', 'system.listNotifications']
    notifications = ['aria2.onDownloadStart', 'aria2.onDownloadPause', 'aria2.onDownloadStop', 'aria2.onDownloadComplete', 'aria2.onDownloadError', 'aria2.onBtDownloadComplete']
}
