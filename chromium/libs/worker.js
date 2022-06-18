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

async function __add__({url, torrent, metalink, options}) {
    if (metalink) {
        await aria2.message('aria2.addMetalink', [metalink, options]);
        waiting = await aria2.message('aria2.tellWaiting', [0, 999]);
        popup.postMessage({manage: {status: 'update', waiting}});
    }
    else {
        if (url) {
            var gid = await aria2.message('aria2.addUri', [[url], options]);
        }
        if (torrent) {
            gid = await aria2.message('aria2.addTorrent', [torrent]);
        }
        __manage__(gid);
    }
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

async function __manage__(gid, add, remove) {
    var result = await aria2.message('aria2.tellStatus', [gid]);
    var {status} = result;
    if (status === 'active') {
        if (!active.find(result => result.gid === gid)) {
            add = 'active';
            active.push(result);
        }
        var wi = waiting.findIndex(result => result.gid === gid);
        if (wi !== -1) {
            waiting.splice(wi, 1);
            remove = 'waiting';
        }
    }
    else {
        if (['waiting', 'paused'].includes(status)) {
            add = 'waiting';
            waiting.push(result);
        }
        else {
            add = 'stopped';
            stopped.push(result);
        }
        var ai = active.findIndex(result => result.gid === gid);
        if (ai !== -1) {
            active.splice(ai, 1);
            remove = 'active';
        }
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
            __manage__(gid);
        }
    };
}
