var aria2Changes = [
    {
        keys: ['jsonrpc_uri', 'jsonrpc_token'],
        action: aria2UpdateRPC
    }, {
        keys: ['manager_newtab'],
        action: aria2UpdateManager
    }, {
        keys: ['manager_interval'],
        action: aria2UpdateInterval
    }
];
var aria2InTab = location.search === '?open_in_tab';

if (aria2InTab) {
    document.body.classList.add('full');
}
else {
    var positionLeft = allQueues.offsetWidth - choose.offsetWidth;
    var positionTop = allQueues.offsetHeight - choose.offsetHeight;
    var positionHeight = manager.offsetHeight + 15;
    choose.style.display = 'none';

    allQueues.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        var {clientX, clientY} = event;
        if (clientX > positionLeft) {
            var left = 'auto';
            var right = '0px';
        }
        else {
            left = `${clientX}px`;
            right = 'auto';
        }
        if (clientY > positionTop) {
            var top = 'auto';
            var bottom = `${positionHeight - clientY}px`;
        }
        else {
            top = `${clientY}px`;
            bottom = 'auto';
        }
        chooseQueue.style.cssText = `display: block; left: ${left}; right: ${right}; top: ${top}; bottom: ${bottom};`;
    });

    allQueues.addEventListener('click', (event) => {
        chooseQueue.style.display = 'none';
    });
}

async function managerDownload() {
    await aria2NewDownload();
    if (!aria2InTab) {
        close();
    }
}

function managerOptions() {
    chrome.runtime.openOptionsPage();
    if (!aria2InTab) {
        close();
    }
}

chrome.runtime.onMessage.addListener(({action, params}, {tab}, response) => {
    if (action !== 'options_onchange') {
        return;
    }
    aria2Storage = params.storage;
    aria2Changes.forEach(({keys, action}) => {
        if (keys.some((key) => params.changes.includes(key))) {
            action();
        }
    });
});

function aria2UpdateRPC() {
    aria2Server = aria2Storage['jsonrpc_uri'];
    aria2Token = aria2Storage['jsonrpc_token'];
    clearInterval(aria2Alive);
    aria2RPC.disconnect();
    aria2ClientSetUp();
}

function aria2UpdateManager() {
    if (!aria2Storage['manager_newtab']) {
        close();
    }
}

function aria2UpdateInterval() {
    aria2Interval = aria2Storage['manager_interval'];
    clearInterval(aria2Alive);
    aria2Alive = setInterval(updateManager, aria2Interval);
}

function aria2UpdateProxy() {
    aria2Proxy = aria2Storage['proxy_server'];
}

chrome.storage.sync.get(null, (json) => {
    aria2Server = json['jsonrpc_uri'];
    aria2Token = json['jsonrpc_token'];
    aria2Interval = json['manager_interval'];
    aria2Proxy = json['proxy_server'];
    aria2ClientSetUp();
});
