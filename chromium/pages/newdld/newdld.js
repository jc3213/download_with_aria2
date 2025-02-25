var aria2Storage = {};
var aria2Config = {};

var [entryPane, jsonrpcPane, proxyBtn] = document.querySelectorAll('#entries, #jsonrpc, #proxy');
var [downMode, downEntry, submitBtn, metaPane, metaImport] = entryPane.querySelectorAll('[id]');
var jsonrpcEntries = jsonrpcPane.querySelectorAll('[name]');

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey) {
        switch (event.key) {
            case 'Enter':
                event.preventDefault();
                submitBtn.click();
                break;
        }
    } else {
        switch (event.key) {
            case 'Escape':
                close();
                break;
        }
    }
});

downMode.addEventListener('change', (event) => {
    document.body.className = event.target.value;
});

submitBtn.addEventListener('click', (event) => {
    var urls = downEntry.value.match(/(https?:\/\/|ftp:\/\/|magnet:\?)[^\s\n]+/g) ?? [];
    if (urls.length !== 1) {
        delete aria2Config['out'];
    }
    var params = urls.map((url) => ({url, options: aria2Config}));
    chrome.runtime.sendMessage({ action: 'jsonrpc_download', params });
    close();
});

metaPane.addEventListener('click', (event) => {
    metaImport.click();
});

metaPane.addEventListener('dragover', (event) => {
    event.preventDefault();
});

metaPane.addEventListener('drop', (event) => {
    event.preventDefault();
    metaFileDownload(event.dataTransfer.files);
});

metaImport.addEventListener('change', (event) => {
    metaFileDownload(event.target.files)
});

async function metaFileDownload(files) {
    var accept = {torrent: 'aria2.addTorrent', meta4: 'aria2.addMetalink', metalink: 'aria2.addMetalink'};
    var options = {...aria2Config, out: null, referer: null, 'user-agent': null};
    var session = [...files].map(async (file) => {
        var type = file.name.slice(file.name.lastIndexOf('.') + 1);
        var method = accept[type];
        if (method) {
            var body = await promiseFileReader(file);
            var params = type === 'torrent' ? [body, [], options] : [body, options];
            return {name: file.name, metadata: {method, params}};
        }
    })
    var params = (await Promise.all(session)).filter((param) => param);
    chrome.runtime.sendMessage({action: 'jsonrpc_metadata', params});
    close();
}

function promiseFileReader(file) {
    return new Promise((resolve) => {
        var reader = new FileReader();
        reader.onload = (event) => resolve(reader.result.slice(reader.result.indexOf(',') + 1));
        reader.readAsDataURL(file);
    });
}

jsonrpcPane.addEventListener('change', (event) => {
    if (event.target.name) {
        aria2Config[event.target.name] = event.target.value;
    }
});

proxyBtn.addEventListener('click', (event) => {
    event.target.previousElementSibling.value = aria2Config['all-proxy'] = aria2Storage['proxy_server'];
});

chrome.runtime.sendMessage({action: 'options_plugins'}, ({storage, options}) => {
    chrome.tabs.query({active: true, currentWindow: false}, (tabs) => {
        aria2Storage = storage;
        options['referer'] = tabs[0].url;
        aria2Config = jsonrpcEntries.disposition(options);
    });
});
