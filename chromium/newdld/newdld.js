var aria2Storage = {};
var aria2Global = {};

var entry = document.getElementById('entries');
var submitBtn = document.getElementById('submit');
var settings = document.querySelectorAll('[name]');

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        submitBtn.click();
    }
});

submitBtn.addEventListener('click', (event) => {
    var urls = entry.value.match(/(https?:\/\/|ftp:\/\/|magnet:\?)[^\s\n]+/g) ?? [];
    if (urls.length !== 1) {
        delete aria2Global['out'];
    }
    var params = urls.map((url) => ({url, options: aria2Global}));
    chrome.runtime.sendMessage({ action: 'jsonrpc_download', params });
    close();
});

document.getElementById('proxy').addEventListener('click', (event) => {
    event.target.previousElementSibling.value = aria2Global['all-proxy'] = aria2Storage['proxy_server'];
});

document.getElementById('download').addEventListener('change', (event) => {
    if (event.target.name) {
        aria2Global[event.target.name] = event.target.value;
    }
});

document.getElementById('uploader').addEventListener('change', async (event) => {
    var options = {...aria2Global, out: null, referer: null};
    var result = [...event.target.files].map((file) => new Promise((resolve) => {
        var name = file.name;
        var reader = new FileReader();
        reader.onload = (event) => {
            var type = file.name.slice(name.lastIndexOf('.') + 1);
            var body = reader.result.slice(reader.result.indexOf(',') + 1);
            var metadata = type === 'torrent' ? { method: 'aria2.addTorrent', params: [body, [], options] } : { method: 'aria2.addMetalink', params: [body, options] };
            resolve({name: file.name, metadata});
        };
        reader.readAsDataURL(file);
    }));
    var params = await Promise.all(result);
    chrome.runtime.sendMessage({action: 'jsonrpc_metadata', params});
    close();
});

chrome.runtime.sendMessage({action: 'options_plugins'}, ({storage, jsonrpc}) => {
    chrome.tabs.query({active: true, currentWindow: false}, (tabs) => {
        aria2Storage = storage;
        jsonrpc['referer'] = tabs[0].url;
        aria2Global = settings.disposition(jsonrpc);
    });
});
