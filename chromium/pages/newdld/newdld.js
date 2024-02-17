var aria2Storage = {};
var aria2Global = {};
var result = {};
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
    try {
        result.json = JSON.parse(entry.value);
        result.url = null;
        delete aria2Global['out'];
    }
    catch (error) {
        result.json = null;
        result.url = entry.value.match(/(https?:\/\/|ftp:\/\/|magnet:\?)[^\s\n]+/g) ?? [];
        if (result.url.length !== 1) {
            delete aria2Global['out'];
        }
    }
    await messageSender('message_download', result);
    close();
}

async function downloadExpand() {
    chrome.windows.getCurrent(({id, top, height}) => {
        chrome.windows.update(id, {top: top - 100, height: height + 195});
        downloader.className = 'extra';
        countdown.textContent = countdown.textContent * 1 + 90;
    });
}

function downloadReferer(refererBtn) {
    chrome.tabs.query({active: true, currentWindow: false}, tabs => {
        refererBtn.previousElementSibling.value = aria2Global['referer'] = tabs[0].url;
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
    if (rid) {
        aria2Global[rid] = value;
    }
});

async function downloadFiles(files) {
    var file = files[0];
    var b64encode = await getFileData(file);
    var session = file.name.endsWith('torrent') ? {method: 'aria2.addTorrent', params: [b64encode]} : {method: 'aria2.addMetalink', params: [b64encode, aria2Global]};
    await aria2RPC.call(...session);
    await aria2WhenStart(file.name);
    close();
}

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

function aria2DownloadSlimmed({url, json, options}) {
    if (json) {
        entry.value = JSON.stringify(json);
        result.json = json;
        filename.disabled = true;
    }
    else {
        entry.value = Array.isArray(url) ? url.join('\n') : url;
        result.url = url;
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
}

async function aria2DowwnloadSetUp(storage, jsonrpc) {
    aria2Storage = storage;
    jsonrpc['user-agent'] = aria2Storage['user_agent'];
    aria2Global = result.options = settings.disposition(jsonrpc);
}

if (slim_mode) {
    chrome.runtime.sendMessage({action: 'download_prompt'}, async ({storage, jsonrpc, params}) => {
        await aria2DowwnloadSetUp(storage, jsonrpc);
        aria2DownloadSlimmed(params);
    });
}
else {
    chrome.runtime.sendMessage({action: 'options_plugins'}, ({storage, jsonrpc}) => {
        aria2DowwnloadSetUp(storage, jsonrpc);
    });
}
