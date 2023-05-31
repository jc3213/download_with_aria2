var entry = document.querySelector('#entry');
var downloader = document.body;
var submitbtn = document.querySelector('#submit_btn');
var countdown = document.querySelector('#countdown');
var filename = document.querySelector('#out');
var slim_mode = location.search === '?slim_mode';

downloader.className = slim_mode ? 'slim' : 'full';

document.addEventListener('keydown', (event) => {
    var {ctrlKey, altKey, key} = event;
    if (ctrlKey && key === 'Enter' || altKey && key === 's') {
        event.preventDefault();
        downloadSubmit();
    }
});

document.querySelector('#menu').addEventListener('click', ({target}) => {
    var id = target.id;
    if (id === 'submit_btn') {
        downloadSubmit();
    }
    else if (id === 'extra_btn') {
        downloadExpand();
    }
});

async function downloadSubmit() {
    var {json, urls} = entry;
    if (json) {
        await aria2DownloadJSON(json, aria2Global);
    }
    else if (urls) {
        await aria2DownloadUrls(urls, aria2Global);
    }
    close();
}

async function downloadExpand() {
    var {id, top, height} = await getCurrentWindow();
    chrome.windows.update(id, {top: top - 105, height: height + 210});
    downloader.className = 'extra';
    countdown.innerText = countdown.innerText * 1 + 90;
}

entry.addEventListener('change', (event) => {
    try {
        entry.json = JSON.parse(entry.value);
        entry.urls = null;
        filename.disabled = true;
    }
    catch (error) {
        entry.json = null;
        entry.urls = entry.value.match(/(https?:\/\/|ftp:\/\/|magnet:\?)[^\s\n]+/g);
        filename.disabled = false;
    }
});

document.querySelector('#referer_btn').addEventListener('click', async ({target}) => {
    chrome.tabs.query({active: true, currentWindow: false}, tabs => {
        var {url} = tabs[0];
        target.previousElementSibling.value = aria2Global['referer'] = url;
    });
});

document.querySelector('#proxy_btn').addEventListener('click', ({target}) => {
    target.previousElementSibling.value = aria2Global['all-proxy'] = aria2Store['proxy_server'];
});

document.querySelector('#upload_btn').addEventListener('change', async ({target}) => {
    var file = target.files[0];
    var b64encode = await getFileData(file);
    if (file.name.endsWith('torrent')){
        await aria2RPC.call('aria2.addTorrent', [b64encode]);
    }
    else {
        await aria2RPC.call('aria2.addMetalink', [b64encode, aria2Global]);
    }
    await aria2WhenStart(file.name);
    close();
});

document.addEventListener('change', ({target}) => {
    var {id, value} = target;
    if (id) {
        aria2Global[id] = value;
    }
});

function slimModeInit() {
    chrome.runtime.sendMessage({action: 'internal_prompt'}, (response) => {
        var {url, json, options} = response;
        if (json) {
            entry.value = JSON.stringify(json);
            entry.json = json;
            filename.disabled = true;
        }
        else {
            entry.value = Array.isArray(url) ? url.join('\n') : url;
            entry.urls = url;
        }
        if (options) {
            var extra = document.querySelectorAll('input[id]').disposition(options);
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

chrome.storage.local.get(null, async (json) => {
    aria2Store = json;
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['jsonrpc_token']);
    var global = await aria2RPC.call('aria2.getGlobalOption');
    global['user-agent'] = aria2Store['user_agent']
    aria2Global = document.querySelectorAll('[id]').disposition(global);
    if (slim_mode) {
        slimModeInit();
    }
});

function getFileData(file) {
    return new Promise((resolve) => {
        var reader = new FileReader();
        reader.onload = (event) => {
            var base64 = reader.result.slice(reader.result.indexOf(',') + 1);
            resolve(base64);
        };
        reader.readAsDataURL(file);
    });
}
