var aria2Storage = {};
var aria2Config = {};

var [jsonrpcPane, entries, proxyBtn, submitBtn, metaImport] = document.querySelectorAll('#download, #entries, #proxy, #submit, #uploader');
var jsonrpcEntries = document.querySelectorAll('[name]');

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        submitBtn.click();
    }
});

jsonrpcPane.addEventListener('change', (event) => {
    if (event.target.name) {
        aria2Config[event.target.name] = event.target.value;
    }
});

proxyBtn.addEventListener('click', (event) => {
    event.target.previousElementSibling.value = aria2Config['all-proxy'] = aria2Storage['proxy_server'];
});

submitBtn.addEventListener('click', (event) => {
    var urls = entries.value.match(/(https?:\/\/|ftp:\/\/|magnet:\?)[^\s\n]+/g) ?? [];
    if (urls.length !== 1) {
        delete aria2Config['out'];
    }
    var params = urls.map((url) => ({url, options: aria2Config}));
    chrome.runtime.sendMessage({ action: 'jsonrpc_download', params });
    close();
});

metaImport.addEventListener('change', async (event) => {
    var options = {...aria2Config, out: null, referer: null};
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

chrome.runtime.sendMessage({action: 'options_plugins'}, ({storage, options}) => {
    chrome.tabs.query({active: true, currentWindow: false}, (tabs) => {
        aria2Storage = storage;
        options['referer'] = tabs[0].url;
        aria2Config = jsonrpcEntries.disposition(options);
    });
});
