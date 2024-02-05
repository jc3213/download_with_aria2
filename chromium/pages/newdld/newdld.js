var downloader = document.body;
var [entry, filename, countdown, uploader] = document.querySelectorAll('textarea, [data-rid="out"], .countdown, input[type="file"]');
var settings = document.querySelectorAll('input[data-rid]');
var slim_mode = location.search === '?slim_mode';

downloader.className = slim_mode ? 'slim' : 'full';

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        downloadSubmit();
    }
});

document.addEventListener('click', (event) => {
    switch (event.target.dataset.bid) {
        case 'submit_btn':
            downloadSubmit();
            break;
        case 'upload_btn':
            uploader.click();
            break;
        case 'extra_btn':
            downloadExpand();
            break;
        case 'referer_btn':
            downloadReferer(event.target);
            break;
        case 'proxy_btn':
            downloadProxy(event.target);
            break;
    }
});

async function downloadSubmit() {
    var {json, urls} = entry;
    if (json) {
        await aria2DownloadJSON(json, aria2Global);
    }
    if (urls) {
        await aria2DownloadUrls(urls, aria2Global);
    }
    close();
}

async function downloadExpand() {
    var {id, top, height} = await getCurrentWindow();
    chrome.windows.update(id, {top: top - 100, height: height + 195});
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
    proxyBtn.previousElementSibling.value = aria2Global['all-proxy'] = aria2Storage['proxy_server'];
}

document.addEventListener('change', ({target}) => {
    var {id, value, files, dataset: {rid}} = target;
    if (files) {
        return downloadFiles(files);
    }
    if (id === 'entries') {
        return changedEntries(value);
    }
    if (rid) {
        aria2Global[rid] = value;
    }
});

async function downloadFiles(files) {
    var file = files[0];
    var b64encode = await getFileData(file);
    var call = file.name.endsWith('torrent') ? ['aria2.addTorrent', b64encode] : ['aria2.addMetalink', b64encode, aria2Global];
    await aria2RPC.call(...call);
    await aria2WhenStart(file.name);
    close();
}

function changedEntries(value) {
    try {
        entry.json = JSON.parse(value);
        entry.urls = null;
        var noname = true;
    }
    catch (error) {
        entry.json = null;
        entry.urls = value.match(/(https?:\/\/|ftp:\/\/|magnet:\?)[^\s\n]+/g) ?? [];
        noname = entry.urls.length < 2 ? false : true;
    }
    if (noname) {
        filename.disabled = true;
        delete aria2Global['out'];
        return;
    }
    filename.disabled = false;
    aria2Global['out'] = filename.value;
}

function slimModeInit() {
    chrome.runtime.sendMessage({action: 'download_prompt'}, ({url, json, options}) => {
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
    aria2Storage = json;
    aria2RPC = new Aria2(aria2Storage['jsonrpc_uri'], aria2Storage['jsonrpc_token']);
    var global = await aria2RPC.call('aria2.getGlobalOption');
    global['user-agent'] = aria2Storage['user_agent']
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
