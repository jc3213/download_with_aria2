var aria2Changes = [
    {keys: ['jsonrpc_uri', 'jsonrpc_token'], action: aria2UpdateRPC},
    {keys: ['manager_newtab'], action: aria2UpdateManager},
    {keys: ['manager_interval'], action: aria2UpdateInterval},
    {keys: ['proxy_server'], action: aria2UpdateProxy}
];
var open_in_tab = location.search === '?open_in_tab';

if (open_in_tab) {
    document.body.classList.add('full');
}
else {
    var positionLeft = aria2Queue.offsetWidth - choose.offsetWidth;
    var positionTop = aria2Queue.offsetHeight - choose.offsetHeight;
    var positionHeight = manager.offsetHeight + 15;
    choose.style.display = 'none';

    aria2Queue.addEventListener('contextmenu', (event) => {
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

    aria2Queue.addEventListener('click', (event) => {
        chooseQueue.style.display = 'none';
    });
}

async function managerDownload() {
    await aria2NewDownload();
    if (!open_in_tab) {
        close();
    }
}

function managerOptions() {
    chrome.runtime.openOptionsPage();
    if (!open_in_tab) {
        close();
    }
}

chrome.storage.onChanged.addListener((changes) => {
    aria2Changes.forEach(({keys, action}) => {
        if (keys.some((key) => key in changes)) {
            action(changes);
        }
    });
});

function aria2UpdateRPC(changes) {
    aria2Server = changes['jsonrpc_uri']?.newValue ?? aria2Server;
    aria2Token = changes['jsonrpc_token']?.newValue ?? aria2Token;
    clearInterval(aria2Alive);
    aria2Socket?.close();
    aria2StartUp();
}

function aria2UpdateManager(changes) {
    if (changes['manager_newtab'].newValue === false) {
        close();
    }
}

function aria2UpdateInterval(changes) {
    aria2Interval = changes['manager_interval'].newValue;
    clearInterval(aria2Alive);
    aria2Alive = setInterval(updateManager, aria2Interval);
}

function aria2UpdateProxy(changes) {
    aria2Proxy = changes['proxy_server'].newValue;
}

chrome.storage.sync.get(null, json => {
    aria2Server = json['jsonrpc_uri'];
    aria2Token = json['jsonrpc_token'];
    aria2Interval = json['manager_interval'];
    aria2Proxy = json['proxy_server'];
    aria2StartUp();
});
