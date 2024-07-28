var aria2Storage = {};
var aria2Global = {};
var activity;
var downloader = document.body;
var [entry, filename, countdown] = document.querySelectorAll('textarea, [data-rid="out"], .countdown');
var settings = document.querySelectorAll('input[data-rid]');

if (location.search === '?slim_mode') {
    downloader.className = 'slim';
    activity = 'download_prompt';
}
else {
    downloader.className = 'full';
    activity = 'options_plugins';
}

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
    var urls = entry.value.match(/(https?:\/\/|ftp:\/\/|magnet:\?)[^\s\n]+/g) ?? [];
    if (urls.length !== 1) {
        delete aria2Global['out'];
    }
    urls = urls.map((url) => ({url, options: aria2Global}));
    chrome.runtime.sendMessage({action: 'message_download', params: {urls}});
    close();
}

async function downloadExpand() {
    chrome.windows.getCurrent(({id, top, height}) => {
        chrome.windows.update(id, {top: top - 92, height: height + 183});
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

document.addEventListener('change', (event) => {
    var {files, dataset: {rid}, value} = event.target;
    if (files) {
        return downloadFiles(files);
    }
    if (rid) {
        aria2Global[rid] = value;
    }
});

async function downloadFiles(files) {
    var file = await getFileData(files[0]);
    var files = file.name.endsWith('torrent') ? {torrents: [file]} : {metalinks: [file]};
    chrome.runtime.sendMessage({action: 'message_download', params: files});
    close();
}

function getFileData(file) {
    return new Promise((resolve) => {
        var reader = new FileReader();
        reader.onload = (event) => {
            var body = reader.result.slice(reader.result.indexOf(',') + 1);
            resolve({name: file.name, body, options: aria2Global});
        };
        reader.readAsDataURL(file);
    });
}

function aria2DownloadSlimmed({url, options = {}}, jsonrpc) {
    entry.value = Array.isArray(url) ? url.join('\n') : url;
    aria2Global = settings.disposition({...jsonrpc, ...options});
    setInterval(() => {
        countdown.textContent --;
        if (countdown.textContent === '0') {
            downloadSubmit();
        }
    }, 1000);
}

chrome.runtime.sendMessage({action: activity}, ({storage, jsonrpc, params}) => {
    aria2Storage = storage;
    jsonrpc['user-agent'] = aria2Storage['headers_useragent'];
    if (params) {
        return aria2DownloadSlimmed(params, jsonrpc);
    }
    aria2Global = settings.disposition(jsonrpc);
});
