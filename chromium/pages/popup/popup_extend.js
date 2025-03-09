var aria2Toolbar = location.search === '?toolbar';

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.querySelectorAll('[i18n-tips]').forEach((node) => {
    node.title = chrome.i18n.getMessage(node.getAttribute('i18n-tips'));
});

if (aria2Toolbar) {
    queuePane.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        var css = event.clientX > 487 ? 'right: 0px;' : 'left: ' + event.clientX + 'px;';
        css += event.clientY > 391 ? 'top: auto; bottom: 0px;' : 'top: ' + event.clientY + 'px;';
        filterPane.style.cssText = css + 'display: block;';
    });
    queuePane.addEventListener('click', (event) => {
        filterPane.style.display = 'none';
    });
    manager.add('popup');
}

downBtn.addEventListener('click', async (event) => {
    chrome.runtime.sendMessage({action: 'open_new_download'});
    if (aria2Toolbar) {
        close();
    }
});

optionsBtn.addEventListener('click', (event) => {
    chrome.runtime.openOptionsPage();
    if (aria2Toolbar) {
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
    aria2RPC.retries = storage['jsonrpc_retries'];
    aria2RPC.timeout = storage['jsonrpc_timeout'];
    aria2Proxy = storage['proxy_server'];
    if ('manager_interval' in changes) {
        clearInterval(aria2Interval);
        aria2Delay = storage['manager_interval'] * 1000;
        aria2Interval = setInterval(aria2ClientUpdate, aria2Delay);
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
    aria2Delay = storage['manager_interval'] * 1000;
    aria2Proxy = storage['proxy_server'];
    aria2RPC = new Aria2(storage['jsonrpc_scheme'], storage['jsonrpc_url'], storage['jsonrpc_secret']);
    aria2RPC.retries = storage['jsonrpc_retries'];
    aria2RPC.timeout = storage['jsonrpc_timeout'];
    aria2RPC.onopen = aria2ClientOpened;
    aria2RPC.onclose = aria2ClientClosed;
    aria2RPC.onmessage = aria2ClientMessage;
});
