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
            var left = 'auto;';
            var right = '0px;';
        }
        else {
            left = clientX + 'px;';
            right = 'auto;';
        }
        if (clientY > positionTop) {
            var top = 'auto;';
            var bottom = (positionHeight - clientY) + 'px;';
        }
        else {
            top = clientY + 'px;';
            bottom = 'auto;';
        }
        chooseQueue.style.cssText = 'display: block; left: ' + left + ' right: ' + right + ' top: ' + top + ' bottom: ' + bottom;
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
    var {storage, changes} = params;
    aria2Storage = storage;
    aria2Variables(storage);
    if (!aria2Storage['manager_newtab']) {
        close();
    }
    if ('manager_interval' in changes) {
        clearInterval(aria2Alive);
        aria2Alive = setInterval(updateManager, aria2Interval);
    }
    if ('jsonrpc_host' in changes) {
        clearInterval(aria2Alive);
        aria2RPC.disconnect();
        return aria2ClientSetUp();
    }
    if ('jsonrpc_scheme' in changes) {
        aria2RPC.method = aria2Scheme;
    }
    if ('jsonrpc_secret' in changes) {
        aria2RPC.secret = aria2Secret;
    }
});

function aria2Variables(json) {
    aria2Scheme = json['jsonrpc_scheme']
    aria2Host = json['jsonrpc_host'];
    aria2Secret = json['jsonrpc_secret'];
    aria2Interval = json['manager_interval'];
    aria2Proxy = json['proxy_server'];
}

chrome.storage.sync.get(null, (json) => {
    aria2Variables(json);
    aria2ClientSetUp();
});
