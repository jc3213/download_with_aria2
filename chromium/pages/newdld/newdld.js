var aria2Storage = {};
var aria2Global = {};
var entry = document.getElementById('entries');
var settings = document.querySelectorAll('[data-rid]');

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
        case 'proxy_btn':
            downloadProxy(event);
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

function downloadProxy(event) {
    event.target.previousElementSibling.value = aria2Global['all-proxy'] = aria2Storage['proxy_server'];
}

document.addEventListener('change', (event) => {
    var id = event.target.dataset.rid;
    if (id) {
        aria2Global[id] = value;
    }
});

document.getElementById('menu').addEventListener('change', async (event) => {
    var file = await getFileData(event.target.files[0]);
    var params = file.name.endsWith('torrent') ? {torrents: [file]} : {metalinks: [file]};
    chrome.runtime.sendMessage({action: 'message_download', params});
    close();
}};

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

chrome.runtime.sendMessage({action: 'options_plugins'}, ({storage, jsonrpc}) => {
    chrome.tabs.query({active: true, currentWindow: false}, (tabs) => {
        aria2Storage = storage;
        jsonrpc['user-agent'] = storage['headers_useragent'];
        jsonrpc['referer'] = tabs[0].url;
        aria2Global = settings.disposition(jsonrpc);
    });
});
