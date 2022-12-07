var entry = document.querySelector('#entry');
var submitbtn = document.querySelector('#submit_btn');
var countdown = document.querySelector('#countdown');

if (location.search === '?slim') {
    document.body.className = 'slim';
}
else {
    document.body.className = 'full';
}

document.addEventListener('keydown', event => {
    var {ctrlKey, altKey, keyCode} = event;
    if (altKey) {
        if (keyCode === 83) {
            event.preventDefault();
            submitbtn.click();
        }
    }
    else if (ctrlKey) {
        if (keyCode === 13) {
            event.preventDefault();
            submitbtn.click();
        }
    }
});

document.querySelector('#referer_btn').addEventListener('click', async event => {
    chrome.tabs.query({active: true, currentWindow: false}, tabs => {
        var {url} = tabs[0];
        event.target.previousElementSibling.value = aria2Global['referer'] = url;
    });
});

document.querySelector('#proxy_btn').addEventListener('click', event => {
    event.target.previousElementSibling.value = aria2Global['all-proxy'] = aria2Store['proxy_server'];
});

document.querySelector('#submit_btn').addEventListener('click', async event => {
    try {
        var json = JSON.parse(entry.value);
        await aria2DownloadJSON(json, aria2Global);
    }
    catch (error) {
        var urls = entry.value.match(/(https?:\/\/|ftp:\/\/|magnet:\?)[^\s\n]+/g);
        if (urls) {
            await aria2BatchDownload(urls, aria2Global);
        }
    }
    close();
});

document.querySelector('#upload_btn').addEventListener('change', async event => {
    var file = event.target.files[0];
    var b64encode = await readFileForAria2(file);
    aria2WhenStart(file.name);
    if (file.name.endsWith('torrent')){
        await aria2DownloadTorrent(b64encode);
    }
    else {
        await aria2DownloadMetalink(b64encode, aria2Global);
    }
    close();
});

document.querySelector('#extra_btn').addEventListener('click', async event => {
    var {id, top, height} = await getCurrentWindow();
    chrome.windows.update(id, {top: top - 192, height: height + 383});
    document.body.className = 'compact';
    countdown.innerText = countdown.innerText * 1 + 90;
});

document.addEventListener('change', event => {
    var {name, value} = event.target;
    if (name) {
        aria2Global[name] = value;
    }
});

function slimModeInit() {
    chrome.runtime.sendMessage({type: 'prompt'}, response => {
        var {url, json, options} = response;
        if (json) {
            entry.value = JSON.stringify(json);
        }
        else {
            entry.value = Array.isArray(url) ? url.join('\n') : url;
        }
        if (options) {
            var extra = document.querySelectorAll('[name]').printOptions(options);
            aria2Global = {...aria2Global, ...extra};
        }
        setInterval(() => {
            countdown.innerText --;
            if (countdown.innerText === '0') {
                submitbtn.click();
            }
        }, 1000);
    });
}

async function aria2StartUp() {
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
    var global = await aria2RPC.call('aria2.getGlobalOption');
    global['user-agent'] = aria2Store['user_agent']
    aria2Global = document.querySelectorAll('[name]').printOptions(global);
    if (location.search === '?slim') {
        slimModeInit();
    }
}
