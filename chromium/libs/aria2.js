class Aria2 {
    constructor (url, secret) {
        if (url.startsWith('http')) {
            this.post = this.fetch;
        }
        else if (url.startsWith('ws')) {
            this.post = this.websocket;
        }
        else {
            throw new Error('Invalid JSON-RPC URL, protocal not supported!');
        }
        this.jsonrpc = url;
        this.secret = secret;
    }
    message (method, secret, options) {
        var params = [];
        if (secret !== undefined) {
            params.push('token:' + secret);
        }
        if (Array.isArray(options)) {
            params.push(...options);
        }
        return {id: '', jsonrpc: '2.0', method, params};
    }
    call (method, options) {
        var {jsonrpc, secret, message, post} = this;
        var json = message(method, secret, options);
        var string = JSON.stringify(json);
        return post(jsonrpc, string).then(function (json) {
            var {result, error} = json;
            if (result !== undefined) {
                return result;
            }
            else {
                throw error;
            }
        });
    }
    batch (array) {
        var {jsonrpc, secret, message, post} = this;
        var json = array.map(function (job) {
            var {method, params} = job;
            return message(method, secret, params);
        });
        var string = JSON.stringify(json);
        return post(jsonrpc, string).then(function (array) {
            var result = array.map(function (json) {
                var {result, error} = json;
                if (result !== undefined) {
                    return result;
                }
                else {
                    throw error;
                }
            });
            return result;
        });
    }
    fetch (jsonrpc, body) {
        return fetch(jsonrpc, {method: 'POST', body}).then(function (response) {
            return response.json();
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
                var json = JSON.parse(event.data);
                resolve(json);
            };
        });
    }
    get methods () {
        return ['aria2.addUri', 'aria2.addTorrent', 'aria2.addMetalink', 'aria2.remove', 'aria2.forceRemove', 'aria2.pause', 'aria2.pauseAll', 'aria2.forcePause', 'aria2.forcePauseAll', 'aria2.unpause', 'aria2.unpauseAll', 'aria2.tellStatus', 'aria2.getUris', 'aria2.getFiles', 'aria2.getPeers', 'aria2.getServers', 'aria2.tellActive', 'aria2.tellWaiting', 'aria2.tellStopped', 'aria2.changePosition', 'aria2.changeUri', 'aria2.getOption', 'aria2.changeOption', 'aria2.getGlobalOption', 'aria2.changeGlobalOption', 'aria2.getGlobalStat', 'aria2.purgeDownloadResult', 'aria2.removeDownloadResult', 'aria2.getVersion', 'aria2.getSessionInfo', 'aria2.shutdown', 'aria2.forceShutdown', 'aria2.saveSession', 'system.multicall', 'system.listMethods', 'system.listNotifications'];
    }
    get notifications () {
        return ['aria2.onDownloadStart', 'aria2.onDownloadPause', 'aria2.onDownloadStop', 'aria2.onDownloadComplete', 'aria2.onDownloadError', 'aria2.onBtDownloadComplete'];
    }
}
