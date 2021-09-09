var jsonrpc;
var token;
var aria2RPCClient;
var aria2RPCAssist;
var aria2KeepAlive;

function aria2RPCKeepAlive() {
    jsonrpc = aria2RPC.jsonrpc['uri'];
    token = aria2RPC.jsonrpc['token'];
    if (aria2RPCClient) {
        aria2RPCClient();
        clearInterval(aria2KeepAlive);
        aria2KeepAlive = setInterval(aria2RPCClient, aria2RPC.jsonrpc['refresh']);
    }
    if (aria2RPCAssist) {
        aria2RPCAssist();
    }
}

browser.storage.local.get(null, result => {
    if ('jsonrpc' in result) {
        aria2RPC = result;
        aria2RPCKeepAlive();
    }
    else {
        fetch('options.json').then(response => response.json()).then(json => {
            aria2RPC = json;
            aria2RPCKeepAlive();
            browser.storage.local.set(json);
        });
    }
});

browser.storage.onChanged.addListener(changes => {
    Object.keys(changes).forEach(key => {
        aria2RPC[key] = changes[key].newValue;
        if (key === 'jsonrpc') {
            aria2RPCKeepAlive();
        }
    });
});

function aria2RPCRequest(request, resolve, reject) {
    var requestJSON = Array.isArray(request) ? request : [request];
    fetch(jsonrpc, {method: 'POST', body: JSON.stringify(requestJSON)}).then(response => {
        if (response.ok) {
            return response.json();
        }
        else {
            throw(response.statusText);
        }
    }).then(responseJSON => {
        var {result, error} = responseJSON[0];
        if (result && typeof resolve === 'function') {
            resolve(...responseJSON.map(item => item.result));
        }
        if (error) {
            throw(error.message);
        }
    }).catch(error => {
        if (typeof reject === 'function') {
            reject(error);
        }
    });
}

function downloadWithAria2({url, referer = '', domain, filename, folder, storeId}, options = {}) {
    var url = Array.isArray(url) ? url : [url];
    browser.cookies.getAll({url: url[0], storeId}).then(cookies => {
        options['header'] = ['Cookie:', 'Referer: ' + referer, 'User-Agent: ' + aria2RPC['useragent']];
        cookies.forEach(cookie => options['header'][0] += ' ' + cookie.name + '=' + cookie.value + ';');
        if (folder) {
            options['dir'] = folder;
        }
        if (filename) {
            options['out'] = filename;
        }
        if (!('all-proxy' in options) && aria2RPC.proxy['resolve'].includes(domain)) {
            options['all-proxy'] = aria2RPC.proxy['uri'];
        }
        aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.addUri', params: [token, url, options]},
        result => showNotification(url[0]), showNotification);
    });
}

function showNotification(message = '') {
    browser.notifications.create({
        type: 'basic',
        title: jsonrpc,
        iconUrl: '/icons/icon48.png',
        message: message
    }, id => {
        setTimeout(() => {
            browser.notifications.clear(id);
        }, 5000);
    });
}
