let aria2Storage = {};
let aria2Config = {};
let aria2Referer = new Map();

let [menuPane, downEntry, metaPane, metaImport, jsonrpcPane] = document.body.children;
let [, downMode, submitBtn] = menuPane.children;
let refererPane = document.getElementById('referer');
let [refererEntry, ...jsonrpcEntries] = jsonrpcPane.querySelectorAll('[name]');
let limitEntry = jsonrpcEntries.pop();

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.querySelectorAll('[i18n-tips]').forEach((node) => {
    node.title = chrome.i18n.getMessage(node.getAttribute('i18n-tips'));
});

function shortcutHandler(event, button) {
    if (event.ctrlKey) {
        event.preventDefault();
        button.click();
    }
}

const shortcutMap = {
    'Enter': (event) => shortcutHandler(event, submitBtn),
    'Tab': (event) => shortcutHandler(event, downMode),
    'Escape': () => close()
};

document.addEventListener('keydown', (event) => {
    shortcutMap[event.key]?.(event);
});

document.addEventListener('click', (event) => {
    if (event.target !== refererEntry && !refererPane.classList.contains('hidden')) {
        refererPane.classList.add('hidden'); 
    }
});

downMode.addEventListener('click', (event) => {
    downMode.value = downMode.value === 'meta' ? 'link' : 'meta';
    document.body.classList.toggle('meta');
});

downMode.addEventListener('mousedown', (event) => {
    event.preventDefault();
});

submitBtn.addEventListener('click', (event) => {
    let urls = downEntry.value.match(/(https?:\/\/|ftp:\/\/|magnet:\?)[^\s\n]+/g) ?? [];
    if (urls.length !== 1) {
        delete aria2Config['out'];
    }
    let params = urls.map((url) => ({ method: 'aria2.addUri', params: [[url], aria2Config] }));
    chrome.runtime.sendMessage({ action: 'jsonrpc_download', params }, close);
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

async function metafileHandler(method, file, params) {
    return new Promise((resolve) => {
        let reader = new FileReader();
        reader.onload = (event) => {
            let { result } = event.target;
            let body = result.slice(result.indexOf(',') + 1);
            params.unshift(body);
            resolve({ method, params });
        };
        reader.readAsDataURL(file);
    });
}

const metafileMap = {
    'torrent': (file, options) => metafileHandler('aria2.addTorrent', file, [ [], options ]),
    'meta4': (file, options) => metafileHandler('aria2.addMetalink', file, [ options ]),
    'metalink': (file, options) => metafileHandler('aria2.addMetalink', file, [ options ])
};

async function metaFileDownload(files) {
    aria2Config['out'] = aria2Config['referer'] = aria2Config['user-agent'] = null;
    let datas = [...files].map((file) => {
        let { name } = file;
        let type = name.slice(name.lastIndexOf('.') + 1);
        return metafileMap[type]?.(file, aria2Config);
    }).filter(Boolean);
    let params = await Promise.all(datas);
    chrome.runtime.sendMessage({ action: 'jsonrpc_download', params }, close);
}

jsonrpcPane.addEventListener('change', (event) => {
    aria2Config[event.target.name] = event.target.value;
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
    let regexp = new RegExp(entry.replace(/[.?/]/g, '\\$&'), 'g');
    aria2Referer.values().forEach((referer) => {
        if (referer.title.includes(entry)) {
            referer.classList.remove('hidden');
            referer.innerHTML = referer.title.replace(regexp, '<mark>$&</mark>');
        } else {
            referer.classList.add('hidden');
            referer.textContent = referer.title;
        }
    });
}

refererPane.addEventListener('click', (event) => {
    aria2Config['referer'] = refererEntry.value = event.target.title;
});

document.getElementById('proxy').addEventListener('click', (event) => {
    aria2Config['all-proxy'] = event.target.previousElementSibling.value = aria2Storage['proxy_server'];
});

function refererModalList(id, url) {
    if (!url?.startsWith('http')) {
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
    tabs.forEach(({ id, url }) => {
        refererModalList(id, url);
    });
});

chrome.tabs.onUpdated.addListener((tabId, { url }) => {
    refererModalList(tabId, url);
});

chrome.tabs.onRemoved.addListener((tabId) => {
    if (aria2Referer.has(tabId)) {
        aria2Referer.get(tabId).remove();
        aria2Referer.delete(tabId);
    }
});

chrome.runtime.sendMessage({ action: 'system_runtime' }, ({ storage, options }) => {
    aria2Storage = storage;
    limitEntry.value = '0';
    jsonrpcEntries.forEach((entry) => {
        let { name } = entry;
        entry.value = aria2Config[name] = options[name] ?? '';
    });
});
