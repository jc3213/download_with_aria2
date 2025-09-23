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

chrome.runtime.onMessage.addListener(({ action, params }) => {
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
    aria2Delay = json['manager_interval'] * 1000;
    aria2Proxy = json['proxy_server'];
    aria2RPC.retries = json['jsonrpc_retries'];
    aria2RPC.timeout = json['jsonrpc_timeout'];
    aria2RPC.connect();
}

chrome.runtime.sendMessage({ action: 'system_runtime' }, ({ storage }) => {
// remove old filter rule
    storage['manager_filter'] ??= JSON.parse(localStorage.getItem('queue')) ?? [];
    localStorage.removeItem('queue');
//
    taskFilters(storage['manager_filter'], (params) => {
        chrome.runtime.sendMessage({ action: 'storage_update', params: { changes: ['manager_filter'], 'manager_filter': array } });
    });
    i18nEntry.value = chrome.i18n.getMessage('extension_locale');
    i18nEntry.disabled = true;
    aria2ClientSetup(storage['jsonrpc_scheme'], storage['jsonrpc_url'], storage['jsonrpc_secret']);
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
    margin: 4px;
    width: 680px;
}

#menu::before,
#filter::before,
#system::before,
#locale, #version,
#system > :nth-child(n+5) {
    display: none;
}

#menu, #system {
    border-width: 0px;
    flex-direction: row;
    padding: 0px;
}

#system {
    grid-area: 1 / 1 / 2 / 3;
}

#system > div {
    flex: 1;
    padding: 3px;
}

#system > ::before {
    margin: 0px;
}

#filter {
    display: none;
    position: fixed;
    z-index: 9;
}

#queue {
    border-radius: 0px;
    border-style: solid;
    border-width: 2px 0px 0px;
    grid-area: 2 / 1 / 3 / 4;
    height: 540px;
    padding-top: 4px;
}
`;
}
