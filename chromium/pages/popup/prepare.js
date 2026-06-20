i18nEntry.value = chrome.i18n.getMessage('extension_locale');
i18nEntry.disabled = true;

menuPane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n');

    if (!menu) {
        return;
    }

    if (menu === 'popup_purge') {
        menuPurge();
        return;
    }

    if (menu === 'popup_newdld') {
        chrome.runtime.sendMessage({ action: 'newdld_window' });
        return;
    }

    if (menu === 'popup_options') {
        chrome.runtime.openOptionsPage();
        return;
    }
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.action !== 'update_storage') {
        return;
    }

    let params = message.params;

    if (!params['manager_newtab']) {
        close();
    }

    storageDispatch(params);
});

function storageDispatch(json) {
    aria2Delay = json['manager_interval'] * 1000;
    aria2Proxy = json['proxy_server'];
    aria2.url = json['jsonrpc_url'];
    aria2.secret = json['jsonrpc_secret'];
    aria2.retries = json['jsonrpc_retries'];
    aria2.timeout = json['jsonrpc_timeout'];
    aria2.connect();
}

chrome.runtime.sendMessage({ action: 'popup_runtime' }, (message) => {
    let storage = message.storage;

    taskFilters(storage['manager_filters'], (params) => {
        chrome.runtime.sendMessage({ action: 'popup_queues', params });
    });

    storageDispatch(storage);
});

if (location.search === '?toolbar') {
    let divider = document.createElement('hr');
    let toolbar = document.createElement('style');

    document.body.append(divider, toolbar);

    queuePane.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        let css = event.clientX > 528 ? 'right: 0px;' : 'left: ' + event.clientX + 'px;';
        css += event.clientY > 365 ? 'bottom: 0px;' : 'top: ' + event.clientY + 'px;';
        filterPane.style.cssText = css + 'display: flex;';
    });

    queuePane.addEventListener('click', (event) => {
        filterPane.style.display = '';
    });

    toolbar.textContent = `
body {
    margin: 4px;
    width: 680px;
}

hr {
    grid-area: 2 / 1 / 3 / 4;
    margin: 0px 0px 1px;
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
    grid-area: 3 / 1 / 4 / 4;
    height: 540px;
}
`;
}
