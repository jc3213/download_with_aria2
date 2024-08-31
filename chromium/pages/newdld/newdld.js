var aria2Storage = {};
var aria2Global = {};
var aria2Upload = {
    torrent: [],
    metalink: [],
    meta4: []
};
var entry = document.getElementById('entries');
var settings = document.querySelectorAll('[name]');

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

document.getElementById('download').addEventListener('change', (event) => {
    var id = event.target.name;
    if (id) {
        aria2Global[id] = event.target.value;
    }
});

document.getElementById('uploader').addEventListener('change', async (event) => {
    await Promise.all([...event.target.files].map((file) => new Promise((resolve) => {
        var reader = new FileReader();
        reader.onload = (event) => {
            var {name} = file;
            var type = name.slice(name.lastIndexOf('.') + 1);
            var body = reader.result.slice(reader.result.indexOf(',') + 1);
            var data = aria2Upload[type].push({name: file.name, body, options: aria2Global});
            resolve(data);
        };
        reader.readAsDataURL(file);
    })));
    var params = {torrents: aria2Upload.torrent, metalinks: [...aria2Upload.metalink, ...aria2Upload.meta4]};
    chrome.runtime.sendMessage({action: 'message_download', params});
    close();
});

chrome.runtime.sendMessage({action: 'options_plugins'}, ({storage, jsonrpc}) => {
    chrome.tabs.query({active: true, currentWindow: false}, (tabs) => {
        aria2Storage = storage;
        jsonrpc['user-agent'] = storage['headers_useragent'];
        jsonrpc['referer'] = tabs[0].url;
        aria2Global = settings.disposition(jsonrpc);
    });
});
