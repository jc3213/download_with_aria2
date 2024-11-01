var aria2InTab = location.search !== '?toolbar';

aria2InTab ? manager.add('full') : aria2Toolbar();

function aria2Toolbar() {
    var queue = document.getElementById('queue');
    var left = queue.offsetWidth - choose.offsetWidth;
    var top = queue.offsetHeight - choose.offsetHeight + 58;
    queue.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        var {clientX, clientY} = event;
        var css = clientX > left ? 'right: 0px;' : 'left: ' + clientX + 'px;';
        css += clientY > top ? 'top: auto; bottom: 0px;' : 'top: ' + clientY + 'px;';
        chooseQueue.style.cssText = css;
    });
    queue.addEventListener('click', (event) => {
        chooseQueue.style.display = 'none';
    });
    choose.style.display = 'none';
}

downBtn.addEventListener('click', async (event) => {
    chrome.runtime.sendMessage({action: 'open_new_download'});
    if (!aria2InTab) {
        close();
    }
});

optionsBtn.addEventListener('click', (event) => {
    chrome.runtime.openOptionsPage();
    if (!aria2InTab) {
        close();
    }
});

chrome.runtime.onMessage.addListener(({action, params}, sender, response) => {
    if (action !== 'options_onchange') {
        return;
    }
    var {storage, changes} = params;
    if ('manager_newtab' in changes && !changes['manager_newtab']) {
        close();
    }
    if ('manager_interval' in changes) {
        clearInterval(aria2Interval);
        aria2Delay = storage['manager_interval'] * 1000;
        aria2Interval = setInterval(aria2ClientUpdate, aria2Delay);
    }
    if ('proxy_server' in changes) {
        aria2Proxy = storage['proxy_server'];
    }
    if ('jsonrpc_scheme' in changes) {
        aria2RPC.scheme = storage['jsonrpc_scheme'];
    }
    if ('jsonrpc_secret' in changes) {
        aria2RPC.secret = storage['jsonrpc_secret'];
    }
    if ('jsonrpc_url' in changes) {
        aria2RPC.url = storage['jsonrpc_url'];
    }
});

chrome.runtime.sendMessage({action: 'options_plugins'}, ({storage}) => {
    aria2RPC = new Aria2(storage['jsonrpc_scheme'], storage['jsonrpc_url'], storage['jsonrpc_secret']);
    aria2RPC.retries = storage['jsonrpc_retries'];
    aria2RPC.onmessage = aria2WebSocket;
    aria2RPC.onclose = aria2ClientWorker;
    aria2Delay = storage['manager_interval'] * 1000;
    aria2Proxy = storage['proxy_server'];
    aria2ClientWorker();
});
