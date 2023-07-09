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
        var {target, clientX, clientY} = event;
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

    aria2Queue.addEventListener('click', ({target}) => {
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
    var {jsonrpc_uri, jsonrpc_token, manager_newtab, manager_interval, proxy_server} = changes;
    if (jsonrpc_uri || jsonrpc_token) {
        aria2Server = jsonrpc_uri?.newValue ?? aria2Server;
        aria2Token = jsonrpc_token?.newValue ?? aria2Token;
        clearInterval(aria2Alive);
        aria2Socket?.close();
        aria2StartUp();
    }
    if (manager_interval) {
        aria2Interval = manager_interval.newValue;
        clearInterval(aria2Alive);
        aria2Alive = setInterval(updateManager, aria2Interval);
    }
    if (manager_newtab?.newValue === false) {
        close();
    }
    if (proxy_server) {
        aria2Proxy = proxy_server.newValue;
    }
});

chrome.storage.local.get(null, json => {
    aria2Server = json['jsonrpc_uri'];
    aria2Token = json['jsonrpc_token'];
    aria2Interval = json['manager_interval'];
    aria2Proxy = json['proxy_server'];
    aria2StartUp();
});
