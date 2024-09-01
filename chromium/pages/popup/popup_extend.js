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
    aria2Variables(storage);
    if ('manager_newtab' in changes && !changes['manager_newtab']) {
        close();
    }
    if (changes['manager_interval']) {
        clearInterval(aria2Alive);
        aria2Alive = setInterval(updateManager, aria2Interval);
    }
    if (changes['jsonrpc_scheme']) {
        aria2RPC.scheme = aria2Scheme;
    }
    if (changes['jsonrpc_secret']) {
        aria2RPC.secret = aria2Secret;
    }
    if (changes['jsonrpc_url']) {
        aria2RPC.url = aria2Url;
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
    aria2ClientSetup();
});
