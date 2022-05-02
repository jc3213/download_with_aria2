importScripts('/libs/aria2.js');

addEventListener('connect', event => {
    var port = event.ports[0];
    port.onmessage = event => {
        var {origin, jsonrpc, secret, purge, remove, gid, url, torrent, metalink, options} = event.data;
        if (origin === 'background') {
            core = port;
        }
        if (origin === 'manager') {
            popup = port;
            popup.postMessage({status, active, waiting, stopped});
        }
        if (jsonrpc) {
            initManager(jsonrpc, secret);
        }
        if (purge) {
            stopped = [];
        }
        if (remove) {
            var ri = self[remove].findIndex(result => result.gid === gid);
            self[remove].splice(ri, 1);
            popup.postMessage({remove});
        }
        if (url) {
            download('aria2.addUri', [Array.isArray(url) ? url : [url], options]);
        }
        if (torrent) {
            download('aria2.addTorrent', [torrent]);
        }
        if (metalink) {
            download('aria2.addMetalink', [metalink, options]);
        }
    };
});

function management(add, result, remove, pos) {
    self[add].push(result);
    if (remove) {
        self[remove].splice(pos, 1);
    }
    if (popup) {
        popup.postMessage({add, result, remove});
    }
}

async function download(method, params) {
    var gid = await aria2.message(method, params);
    if (active.length === maximum) {
        var result = await aria2.message('aria2.tellStatus', [gid]);
        waiting.push(result);
    }
}

function initManager(jsonrpc, secret) {
    if (self.socket && socket.readyState === 1) {
        socket.close();
    }
    aria2 = new Aria2(jsonrpc, secret);
    aria2.message('aria2.getGlobalOption').then(async options => {
        active = await aria2.message('aria2.tellActive');
        waiting = await aria2.message('aria2.tellWaiting', [0, 999]);
        stopped = await aria2.message('aria2.tellStopped', [0, 999]);
        maximum = options['max-concurrent-downloads'] | 0;
        status = 'OK';
        core.postMessage({text: active.length, color: '#3cc'});
        initSocket(jsonrpc.replace('http', 'ws'));
    }).catch(error => {
        core.postMessage({text: 'E', color: '#c33'});
        status = error;
    });
}

function initSocket(server) {
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
                        management('active', result, 'waiting', wi);
                    }
                    else {
                        var si = stopped.findIndex(result => result.gid === gid);
                        if (si !== -1) {
                            management('active', result, 'stopped', si);
                        }
                        else {
                            management('active', result);
                        }
                    }
                }
            }
            else {
                if (method === 'aria2.onDownloadPause') {
                    management('waiting', result, 'active', ai);
                }
                else {
                    management('stopped', result, 'active', ai);
                }
            }
            core.postMessage({text: active.length, color: '#3cc'});
        }
    };
}
