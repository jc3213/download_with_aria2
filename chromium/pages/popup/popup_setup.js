if (location.search === '?toolbar') {
    aria2ToolbarSetup();
}

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.querySelectorAll('[i18n-tips]').forEach((node) => {
    node.title = chrome.i18n.getMessage(node.getAttribute('i18n-tips'));
});

downBtn.addEventListener('click', (event) => {
    chrome.runtime.sendMessage({action: 'open_new_download'});
});

optionsBtn.addEventListener('click', (event) => {
    chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener(({action, params}) => {
    if (action !== 'storage_update') {
        return;
    }
    if (!params['manager_newtab']) {
        close();
    }
    aria2RPC.disconnect();
    aria2RPC.scheme = params['jsonrpc_scheme'];
    aria2RPC.url = params['jsonrpc_url'];
    aria2RPC.secret = params['jsonrpc_secret'];
    aria2StorageChanged(params);
});

function aria2StorageChanged(json) {
    aria2RPC.retries = json['jsonrpc_retries'];
    aria2RPC.timeout = json['jsonrpc_timeout'];
    aria2RPC.connect();
    aria2Delay = json['manager_interval'] * 1000;
    aria2Proxy = json['proxy_server'];
}

chrome.runtime.sendMessage({action: 'system_runtime'}, ({storage}) => {
    aria2RPC = new Aria2(storage['jsonrpc_scheme'], storage['jsonrpc_url'], storage['jsonrpc_secret']);
    aria2RPC.onopen = aria2ClientOpened;
    aria2RPC.onclose = aria2ClientClosed;
    aria2RPC.onmessage = aria2ClientMessage;
    aria2StorageChanged(storage);
});

function aria2ToolbarSetup() {
    queuePane.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        let css = event.clientX > 487 ? 'right: 0px;' : 'left: ' + event.clientX + 'px;';
        css += event.clientY > 391 ? 'bottom: 0px;' : 'top: ' + event.clientY + 'px;';
        filterPane.style.cssText = css + 'display: block;';
    });
    queuePane.addEventListener('click', (event) => {
        filterPane.style.display = 'none';
    });
    let toolbar = document.createElement('style');
    document.head.appendChild(toolbar);
    toolbar.textContent = `
body {
    width: 680px;
    margin: 4px 0px 0px;
}

#menu::before,
#filter::before {
    display: none;
}

#menu {
    border-radius: 0px;
    border-width: 0px 0px 2px;
    flex-direction: row;
    grid-area: 1 / 1 / 2 / 3;
    padding: 0px 4px 4px;
}

#menu > button {
    order: 9;
}

#menu > div::before {
    margin-left: 0px;
    width: auto;
}

#menu > div {
    padding: 3px 5px 0px 0px;
}

#menu > div:nth-child(n+6) {
    display: none;
}

#filter {
    display: none;
    position: fixed;
    z-index: 9;
}

#queue {
    grid-area: 2 / 1 / 4 / 3;
    height: 540px;
    overflow-y: auto;
}
`;
}
