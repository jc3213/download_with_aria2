let aria2Proxy;
let aria2Config = {};
let aria2Referer = new Map();

let mainTree = document.body.children;
let menuPane = mainTree[0];
let downEntry = mainTree[1];
let jsonrpcPane = mainTree[2];

let entries = jsonrpcPane.querySelectorAll('[name]');
let refererEntry = entries[0];
let jsonrpcEntries = [];
for (let i = 1, l = entries.length; i < l; i++) {
    jsonrpcEntries.push(entries[i]);
}

let filesEntry = menuPane.lastElementChild;
let refererPane = document.getElementById('referer');

document.addEventListener('click', (event) => {
    if (event.target !== refererEntry && !refererPane.classList.contains('hidden')) {
        refererPane.classList.add('hidden'); 
    }
});

function menuSubmit() {
    let urls = downEntry.value.match(/(https?:\/\/|ftp:\/\/|magnet:\?)[^\s\n]+/g);
    if (!urls) {
        close();
    }
    let l = urls.length;
    let out = aria2Config.out;
    aria2Config['out'] = l !== 1 || !out ? null : out.replace(/[\\/:*?"<>|]/g, '_');
    let params = [];
    for (let i = 0; i < l; i++) {
        params.push({ method: 'aria2.addUri', params: [[ urls[i] ], aria2Config] });
    }
    chrome.runtime.sendMessage({ action: 'remote_download', params }, close);
}

const menuEvents = {
    'task_addfiles': () => filesEntry.click(),
    'common_submit': menuSubmit
};

menuPane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n');
    let handler = menuEvents[menu];
    if (handler) {
        handler();
    }
});

document.addEventListener('dragover', (event) => {
    event.preventDefault();
});

document.addEventListener('drop', (event) => {
    event.preventDefault();
    metaFileDownload(event.dataTransfer.files);
});

filesEntry.addEventListener('change', (event) => {
    metaFileDownload(event.target.files)
});

async function metaFileDownload(files) {
    aria2Config['out'] = aria2Config['referer'] = aria2Config['user-agent'] = null;
    let tasks = [];
    for (let i = 0, l = files.length; i < l; i++) {
        let file = files[i];
        let name = file.name;
        let method;
        let params;
        if (name.endsWith('.torrent')) {
            method = 'aria2.addTorrent';
            params = [[], aria2Config];
        } else if (name.endsWith('.meta4') || name.endsWith('.metalink')) {
            method = 'aria2.addMetalink';
            params = [aria2Config];
        } else {
            continue;
        }
        tasks.push(new Promise((resolve) => {
            let reader = new FileReader();
            reader.onload = (event) => {
                let result = reader.result;
                params.unshift(result.substring(result.indexOf(',') + 1));
                resolve({ method, params });
            };
            reader.readAsDataURL(file);
        }));
    }
    let params = await Promise.all(tasks);
    chrome.runtime.sendMessage({ action: 'remote_download', params }, close);
}

jsonrpcPane.addEventListener('change', (event) => {
    let entry = event.target;
    aria2Config[entry.name] = entry.value;
});

refererEntry.addEventListener('click', (event) => {
    refererModalPopup();
    refererPane.classList.remove('hidden');
});

refererEntry.addEventListener('input', (event) => {
    refererModalPopup();
});

function refererModalPopup() {
    let entry = refererEntry.value;
    for (let referer of aria2Referer.values()) {
        if (referer.title.includes(entry)) {
            referer.classList.remove('hidden');
            referer.innerHTML = referer.title.replaceAll(entry, '<mark>$&</mark>');
        } else {
            referer.classList.add('hidden');
            referer.textContent = referer.title;
        }
    }
}

refererPane.addEventListener('click', (event) => {
    aria2Config['referer'] = refererEntry.value = event.target.title;
});

document.getElementById('proxy').addEventListener('click', (event) => {
    aria2Config['all-proxy'] = event.target.previousElementSibling.value = aria2Proxy;
});

function refererModalList(id, url) {
    if (!url.startsWith('http')) {
        return;
    }
    let referer = aria2Referer.get(id);
    if (!referer) {
        referer = document.createElement('div');
        refererPane.appendChild(referer);
        aria2Referer.set(id, referer);
    }
    referer.title = referer.textContent = url;
}

chrome.tabs.query({}, (tabs) => {
    for (let i = 0, l = tabs.length; i < l; i++) {
        let tab = tabs[i];
        refererModalList(tab.id, tab.url);
    }
});

chrome.tabs.onUpdated.addListener((tabId, tab) => {
    if (tab.url) {
        refererModalList(tabId, tab.url);
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    if (aria2Referer.has(tabId)) {
        aria2Referer.get(tabId).remove();
        aria2Referer.delete(tabId);
    }
});

chrome.runtime.sendMessage({ action: 'newdld_runtime' }, (message) => {
    let config = message.options;
    aria2Proxy = message.storage['proxy_server'];
    for (let i = 0, l = jsonrpcEntries.length; i < l; i++) {
        let entry = jsonrpcEntries[i];
        let name = entry.name;
        let value = config[name];
        if (value) {
            entry.value = aria2Config[name] = value;
        }
    }
});
