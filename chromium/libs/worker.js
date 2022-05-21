importScripts('/libs/aria2.js');

addEventListener('connect', event => {
    var port = event.ports[0];
    port.onmessage = event => {
        var {origin, jsonrpc, secret, purge, remove, gid, add} = event.data;
        if (origin === 'background') {
            core = port;
        }
        if (origin === 'manager') {
            popup = port;
            popup.postMessage({status, active, waiting, stopped});
        }
        if (jsonrpc) {
            __initiate__(jsonrpc, secret);
        }
        if (purge) {
            stopped = [];
        }
        if (remove) {
            __remove__(remove, gid, port);
        }
        if (add) {
            __add__(add);
        }
    };
});

async function __add__({url, torrent, metalink, options}) {
    if (url) {
        await aria2.message('aria2.addUri', [[url], options]);
    }
    if (torrent) {
        await aria2.message('aria2.addTorrent', [torrent]);
    }
    if (metalink) {
        await aria2.message('aria2.addMetalink', [metalink, options]);
    }
    if (active.length === maximum) {
        var result = await aria2.message('aria2.tellStatus', [gid]);
        __manage__('waiting', result);
    }
}

async function __remove__(remove, gid, port) {
    if (remove !== 'stopped') {
        await aria2.message('aria2.forceRemove', [gid]);
    }
    else {
        await aria2.message('aria2.removeDownloadResult', [gid]);
    }
    if (remove !== 'active') {
        var ri = self[remove].findIndex(result => result.gid === gid);
        self[remove].splice(ri, 1);
        port.postMessage({remove});
    }
}

function __manage__(add, result, remove, pos) {
    self[add].push(result);
    if (remove) {
        self[remove].splice(pos, 1);
    }
    if (self.popup) {
        popup.postMessage({add, result, remove});
    }
}

function __initiate__(jsonrpc, secret) {
    aria2 = new Aria2(jsonrpc, secret);
    aria2.message('aria2.getGlobalOption').then(async options => {
        active = await aria2.message('aria2.tellActive');
        waiting = await aria2.message('aria2.tellWaiting', [0, 999]);
        stopped = await aria2.message('aria2.tellStopped', [0, 999]);
        maximum = options['max-concurrent-downloads'] | 0;
        status = 'OK';
        core.postMessage({text: active.length, color: '#3cc'});
        __socket__(jsonrpc.replace('http', 'ws'));
    }).catch(error => {
        core.postMessage({text: 'E', color: '#c33'});
        status = error;
    });
}

function __socket__(server) {
    if (self.socket && socket.readyState === 1) {
        socket.close();
    }
    socket = new WebSocket(server);
    socket.onmessage = async event => {
        var {method, params: [{gid}]} = JSON.parse(event.data);
        if (method !== 'aria2.onBtDownloadComplete') {
            var result = await aria2.message('aria2.tellStatus', [gid]);
            var ai = active.findIndex(result => result.gid === gid);
            if (method === 'aria2.onDownloadStart') {
                if (ai === -1) {
                    var wi = waiting.findIndex(result => result.gid === gid);
                    if (wi !== -1) {
                        __manage__('active', result, 'waiting', wi);
                    }
                    else {
                        __manage__('active', result);
                    }
                }
            }
            else {
                if (method === 'aria2.onDownloadPause') {
                    __manage__('waiting', result, 'active', ai);
                }
                else {
                    __manage__('stopped', result, 'active', ai);
                }
            }
            core.postMessage({text: active.length, color: '#3cc'});
        }
    };
}
