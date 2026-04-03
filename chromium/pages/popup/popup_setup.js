i18nEntry.value = chrome.i18n.getMessage('extension_locale');
i18nEntry.disabled = true;

mainMenus['popup_newdld'] = () => chrome.runtime.sendMessage({ action: 'newdld_window' });
mainMenus['popup_options'] = chrome.runtime.openOptionsPage;

chrome.runtime.onMessage.addListener(({ action, params }) => {
    if (action !== 'options_storage') {
        return;
    }
    if (!params['manager_newtab']) {
        close();
    }
    aria2RPC.disconnect();
    aria2StorageChanged(params);
});

function aria2StorageChanged(json) {
    aria2Delay = json['manager_interval'] * 1000;
    aria2Proxy = json['proxy_server'];
    aria2RPC.url = json['jsonrpc_url'];
    aria2RPC.secret = json['jsonrpc_secret'];
    aria2RPC.retries = json['jsonrpc_retries'];
    aria2RPC.timeout = json['jsonrpc_timeout'];
    aria2RPC.connect();
}

chrome.runtime.sendMessage({ action: 'popup_runtime' }, ({ storage }) => {
    taskFilters(storage['manager_filters'], (params) => {
        chrome.runtime.sendMessage({ action: 'popup_queues', params });
    });
    aria2StorageChanged(storage);
});

if (location.search === '?toolbar') {
    queuePane.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        let css = event.clientX > 528 ? 'right: 0px;' : 'left: ' + event.clientX + 'px;';
        css += event.clientY > 365 ? 'bottom: 0px;' : 'top: ' + event.clientY + 'px;';
        filterPane.style.cssText = css + 'display: flex;';
    });
    queuePane.addEventListener('click', (event) => {
        filterPane.style.display = '';
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
