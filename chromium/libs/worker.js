importScripts('/libs/aria2.js');

var core;
var popup;
var status;
var active;
var waiting;
var stopped;
var socket;

addEventListener('connect', event => {
    var port = event.ports[0];
    port.onmessage = event => {
        var {origin, jsonrpc, secret, purge, add, remove, gid} = event.data;
        if (origin === 'background') {
            core = port;
        }
        if (origin === 'manager') {
            popup = port;
            popup.postMessage({manage: {status, active, waiting, stopped}});
        }
        if (jsonrpc) {
            __initiate__(jsonrpc, secret);
        }
        if (purge) {
            stopped = [];
        }
        if (remove) {
            __remove__(remove, gid);
        }
        if (add) {
            __add__(add);
        }
    };
});

async function __add__({url, batch, torrent, metalink, options}) {
    if (batch) {
        batch.forEach(url => aria2.message('aria2.addUri', [[url], options]));
        setTimeout(__batch__, batch.length * 20);
    }
    else if (metalink) {
        await aria2.message('aria2.addMetalink', [metalink, options]);
        __batch__();
    }
    else {
        if (url) {
            var gid = await aria2.message('aria2.addUri', [[url], options]);
        }
        if (torrent) {
            gid = await aria2.message('aria2.addTorrent', [torrent]);
        }
        if (active.length === maximum) {
            __manage__('waiting', gid);
        }
    }
}

async function __batch__() {
    active = await aria2.message('aria2.tellActive');
    waiting = await aria2.message('aria2.tellWaiting', [0, 999]);
    core.postMessage({text: active.length, color: '#3cc'});
    popup.postMessage({manage: {status: 'update', active, waiting}});
}

async function __remove__(remove, gid) {
    if (remove !== 'stopped') {
        await aria2.message('aria2.forceRemove', [gid]);
    }
    else {
        await aria2.message('aria2.removeDownloadResult', [gid]);
    }
    if (remove !== 'active') {
        var ri = self[remove].findIndex(result => result.gid === gid);
        self[remove].splice(ri, 1);
        popup.postMessage({remove});
    }
}

async function __manage__(add, gid, remove, pos) {
    var result = await aria2.message('aria2.tellStatus', [gid]);
    self[add].push(result);
    if (remove) {
        self[remove].splice(pos, 1);
    }
    core.postMessage({text: active.length, color: '#3cc'});
    if (popup) {
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
        status = 'ok';
        core.postMessage({text: active.length, color: '#3cc'});
        __socket__(jsonrpc.replace('http', 'ws'));
    }).catch(error => {
        core.postMessage({text: 'E', color: '#c33'});
        status = 'error';
    });
}

function __socket__(server) {
    if (socket && socket.readyState === 1) {
        socket.close();
    }
    socket = new WebSocket(server);
    socket.onmessage = async event => {
        var {method, params: [{gid}]} = JSON.parse(event.data);
        if (method !== 'aria2.onBtDownloadComplete') {
            var ai = active.findIndex(result => result.gid === gid);
            if (method === 'aria2.onDownloadStart') {
                if (ai === -1) {
                    var wi = waiting.findIndex(result => result.gid === gid);
                    if (wi !== -1) {
                        __manage__('active', gid, 'waiting', wi);
                    }
                    else {
                        __manage__('active', gid);
                    }
                }
            }
            else {
                if (method === 'aria2.onDownloadPause') {
                    __manage__('waiting', gid, 'active', ai);
                }
                else {
                    __manage__('stopped', gid, 'active', ai);
                }
            }
        }
    };
}
