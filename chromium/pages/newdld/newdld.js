var aria2Storage = {};
var aria2Config = {};
var aria2Referer = [];

var [entryPane, jsonrpcPane, refererPane, proxyBtn] = document.querySelectorAll('#entries, #jsonrpc, #referer, #proxy');
var [, downMode, submitBtn, downEntry, metaPane, metaImport] = entryPane.children;
var jsonrpcEntries = jsonrpcPane.querySelectorAll('[name]');
var refererEntry = jsonrpcEntries[0];

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

document.addEventListener('click', (event) => {
    if (event.target !== refererEntry && refererPane.style.display === 'block') {
        refererPane.style.display = ''; 
    }
});

downMode.addEventListener('change', (event) => {
    document.body.classList.toggle('meta');
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
    chrome.runtime.sendMessage({ action: 'jsonrpc_metadata', params });
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
    aria2Config[event.target.name] = event.target.value;
});

refererEntry.addEventListener('click', (event) => {
    refererModalPopup();
    refererPane.style.display = 'block';
});

refererEntry.addEventListener('input', (event) => {
    refererModalPopup();
});

function refererModalPopup() {
    var entry = refererEntry.value;
    var regexp = new RegExp(entry.replace(/[.?/]/g, '\\$&'), 'gi');
    aria2Referer.forEach((referer) => {
        if (referer.title.includes(entry)) {
            referer.style.display = '';
            referer.innerHTML = referer.title.replace(regexp, '<mark>$&</mark>');
        } else {
            referer.style.display = 'none';
            referer.textContent = referer.title;
        }
    });
}

refererPane.addEventListener('click', (event) => {
    aria2Config['referer'] = refererEntry.value = event.target.title;
});

proxyBtn.addEventListener('click', (event) => {
    aria2Config['all-proxy'] = event.target.previousElementSibling.value = aria2Storage['proxy_server'];
});

chrome.tabs.query({currentWindow: false}, (tabs) => {
    tabs.forEach((tab) => {
        if (tab.url.startsWith('http')) {
            var referer = document.createElement('div');
            referer.title = referer.textContent = tab.url;
            aria2Referer.push(referer);
            refererPane.appendChild(referer);
        }
    });
});

chrome.runtime.sendMessage({action: 'options_plugins'}, ({storage, options}) => {
    aria2Storage = storage;
    aria2Config = jsonrpcEntries.disposition(options);
});
