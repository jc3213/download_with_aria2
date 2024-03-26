var aria2InTab = location.search !== '?as_popup';

if (aria2InTab) {
    manager.add('full');
}
else {
    aria2Popup();
}

function aria2Popup() {
    var positionLeft = allQueues.offsetWidth - choose.offsetWidth;
    var positionTop = allQueues.offsetHeight - choose.offsetHeight + 58;
    choose.style.display = 'none';

    allQueues.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        var {clientX, clientY} = event;
        var css = clientX > positionLeft ? 'right: 0px;' : 'left: ' + clientX + 'px;';
        css += clientY > positionTop ? 'top: auto; bottom: 0px;' : 'top: ' + clientY + 'px;';
        chooseQueue.style.cssText = css;
    });

    allQueues.addEventListener('click', (event) => {
        chooseQueue.style.display = 'none';
    });
}

async function managerDownload() {
    chrome.runtime.sendMessage({action: 'open_new_download'});
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

chrome.runtime.onMessage.addListener(({action, params}, sender, response) => {
    if (action !== 'options_onchange') {
        return;
    }
    var {storage, changes} = params;
    aria2Variables(storage);
    if ('manager_newtab' in changes && !changes['manager_newtab']) {
        close();
    }
    if (changes['manager_interval']) {
        clearInterval(aria2Alive);
        aria2Alive = setInterval(updateManager, aria2Interval);
    }
    if (changes['jsonrpc_url']) {
        clearInterval(aria2Alive);
        aria2RPC.disconnect();
        return aria2ClientSetUp();
    }
    if (changes['jsonrpc_scheme']) {
        aria2RPC.scheme = aria2Scheme;
    }
    if (changes['jsonrpc_secret']) {
        aria2RPC.secret = aria2Secret;
    }
});

function aria2Variables(json) {
    aria2Scheme = json['jsonrpc_scheme']
    aria2Url = json['jsonrpc_url'];
    aria2Secret = json['jsonrpc_secret'];
    aria2Interval = json['manager_interval'] * 1000;
    aria2Proxy = json['proxy_server'];
}

chrome.runtime.sendMessage({action: 'options_plugins'}, ({storage}) => {
    aria2Variables(storage);
    aria2ClientSetUp();
});
