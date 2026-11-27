const aria2 = {
    call(method, params) {
        return aria2.broadcast('jsonrpc_call', { method, params });
    },
    multicall(params) {
        return aria2.broadcast('jsonrpc_multicall', params);
    },
    broadcast(action, params) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action, params }, (response) => {
                if (response.result || response.error) {
                    resolve(response);
                } else {
                    reject(response);
                }
            });
        });
    }
};

i18nEntry.value = chrome.i18n.getMessage('extension_locale');
i18nEntry.disabled = true;

menuPane.addEventListener('click', async (event) => {
    let menu = event.target.getAttribute('i18n');

    if (!menu) {
        return;
    }

    if (menu === 'popup_purge') {
        await aria2.call('aria2.purgeDownloadResult');

        for (let gid of aria2Queue.stopped) {
            aria2Tasks.get(gid).remove();
            aria2Tasks.delete(gid);
        }

        aria2Queue.stopped = new Set();
        aria2Stats.stopped.textContent = '0';
        return;
    }

    if (menu === 'popup_newdld') {
        chrome.runtime.sendMessage({ action: 'window_newdld' });
        return;
    }

    if (menu === 'popup_options') {
        chrome.runtime.sendMessage({ action: 'window_options' });
        return;
    }
});

chrome.runtime.onMessage.addListener((message) => {
    let action = message.action;

    if (!action) {
        return;
    }

    let params = message.params;

    if (action === 'jsonrpc_message') {
        jsonrpcMessage(params);
        return;
    }

    if (action === 'jsonrpc_start') {
        jsonrpcStart();
        return;
    }

    if (action === 'jsonrpc_error') {
        jsonrpcError();
        return;
    }

    if (action === 'commit_options') {
        if (!params['manager_newtab']) {
            close();
        }

        aria2Delay = params['manager_interval'] * 1000;
        aria2Proxy = params['proxy_server'];
        return;
    }
});

chrome.runtime.sendMessage({ action: 'state_popup' }, (message) => {
    let storage = message.storage;
    aria2Delay = storage['manager_interval'] * 1000;
    aria2Proxy = storage['proxy_server'];

    taskQueues(storage['manager_filters'], (params) => {
        chrome.runtime.sendMessage({ action: 'commit_queues', params });
    });

    if (message.isReady) {
        jsonrpcStart();
    }
});

if (location.search === '?toolbar') {
    let divider = document.createElement('hr');
    let toolbar = document.createElement('style');

    document.body.append(divider, toolbar);

    tasksPane.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        let css = event.clientX > 528 ? 'right: 0px;' : 'left: ' + event.clientX + 'px;';
        css += event.clientY > 365 ? 'bottom: 0px;' : 'top: ' + event.clientY + 'px;';
        queuePane.style.cssText = css + 'display: flex;';
        console.log(css);
    });

    tasksPane.addEventListener('click', (event) => {
        queuePane.style.display = '';
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

#filter {
    top: 1%;
}

#menu::before,
#queues::before,
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

#queues {
    display: none;
    position: fixed;
    z-index: 9;
}

#tasks {
    grid-area: 3 / 1 / 4 / 4;
    height: 540px;
}
`;
}
