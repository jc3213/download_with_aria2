var downloader = document.body;
var [entry, filename, countdown, uploader] = document.querySelectorAll('textarea, [data-id="out"], .countdown, input[type="file"]');
var settings = document.querySelectorAll('input[data-id]');
var slim_mode = location.search === '?slim_mode';

downloader.className = slim_mode ? 'slim' : 'full';

document.addEventListener('keydown', (event) => {
    var {ctrlKey, altKey, key} = event;
    if (ctrlKey && key === 'Enter' || altKey && key === 's') {
        event.preventDefault();
        downloadSubmit();
    }
});

document.addEventListener('click', ({target}) => {
    var id = target.dataset.bid;
    if (id === 'submit_btn') {
        downloadSubmit();
    }
    else if (id === 'upload_btn') {
        uploader.click();
    }
    else if (id === 'extra_btn') {
        downloadExpand();
    }
    else if (id === 'referer_btn') {
        downloadReferer(target);
    }
    else if (id === 'proxy_btn') {
        downloadProxy(target);
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
    countdown.textContent = countdown.textContent * 1 + 90;
}

function downloadReferer(refererBtn) {
    chrome.tabs.query({active: true, currentWindow: false}, tabs => {
        var {url} = tabs[0];
        refererBtn.previousElementSibling.value = aria2Global['referer'] = url;
    });
}

function downloadProxy(proxyBtn) {
    proxyBtn.previousElementSibling.value = aria2Global['all-proxy'] = aria2Store['proxy_server'];
}

document.addEventListener('change', ({target}) => {
    var {id, value, files, dataset: {rid}} = target;
    if (files) {
        downloadFiles(files);
    }
    else if (id === 'entries') {
        changedEntries(value);
    }
    else if (rid) {
        aria2Global[rid] = value;
    }
});

async function downloadFiles(files) {
    var file = files[0];
    var b64encode = await getFileData(file);
    if (file.name.endsWith('torrent')){
        await aria2RPC.call('aria2.addTorrent', b64encode);
    }
    else {
        await aria2RPC.call('aria2.addMetalink', b64encode, aria2Global);
    }
    await aria2WhenStart(file.name);
    close();
}

function changedEntries(value) {
    try {
        entry.json = JSON.parse(value);
        entry.urls = null;
        filename.disabled = true;
        delete aria2Global['out'];
    }
    catch (error) {
        entry.json = null;
        entry.urls = value.match(/(https?:\/\/|ftp:\/\/|magnet:\?)[^\s\n]+/g);
        filename.disabled = false;
        aria2Global['out'] = filename.value;
    }
}

function slimModeInit() {
    chrome.runtime.sendMessage({action: 'internal_prompt'}, ({url, json, options}) => {
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
            var extra = settings.disposition(options);
            aria2Global = {...aria2Global, ...extra};
        }
        setInterval(() => {
            countdown.textContent --;
            if (countdown.textContent === '0') {
                downloadSubmit();
            }
        }, 1000);
    });
}

chrome.storage.sync.get(null, async (json) => {
    aria2Store = json;
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['jsonrpc_token']);
    var global = await aria2RPC.call('aria2.getGlobalOption');
    global['user-agent'] = aria2Store['user_agent']
    aria2Global = settings.disposition(global);
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
