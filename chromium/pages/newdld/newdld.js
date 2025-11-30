let aria2Storage = {};
let aria2Config = {};
let aria2Referer = new Map();

let [menuPane, downEntry, jsonrpcPane] = document.body.children;
let [, uploadBtn, submitBtn, metaFiles] = menuPane.children;
let refererPane = document.getElementById('referer');
let [refererEntry, ...jsonrpcEntries] = jsonrpcPane.querySelectorAll('[name]');
let limitEntry = jsonrpcEntries.pop();

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.querySelectorAll('[i18n-tips]').forEach((node) => {
    node.title = chrome.i18n.getMessage(node.getAttribute('i18n-tips'));
});

function ctrlHandler(event, button) {
    if (event.ctrlKey) {
        event.preventDefault();
        button.click();
    }
}

const hotkeyMap = {
    'Enter': (event) => ctrlHandler(event, submitBtn),
    'Backquote': (event) => ctrlHandler(event, uploadBtn),
    'Escape': () => close()
};

document.addEventListener('keydown', (event) => {
    hotkeyMap[event.code]?.(event);
});

document.addEventListener('click', (event) => {
    if (event.target !== refererEntry && !refererPane.classList.contains('hidden')) {
        refererPane.classList.add('hidden'); 
    }
});

function menuSubmit() {
    let urls = downEntry.value.match(/(https?:\/\/|ftp:\/\/|magnet:\?)[^\s\n]+/g) ?? [];
    let { out } = aria2Config;
    aria2Config['out'] = urls.length !== 1 || !out ? null : out.replace(/[\\/:*?"<>|]/g, '_');
    let params = urls.map((url) => ({ method: 'aria2.addUri', params: [[url], aria2Config] }));
    chrome.runtime.sendMessage({ action: 'jsonrpc_download', params }, close);
}

const menuEventMap = {
    'common_upload': () => metaFiles.click(),
    'common_submit': menuSubmit
};

menuPane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n');
    menuEventMap[menu]?.(event);
});

downEntry.addEventListener('dragover', (event) => {
    event.preventDefault();
});

downEntry.addEventListener('drop', (event) => {
    event.preventDefault();
    metaFileDownload(event.dataTransfer.files);
});

metaFiles.addEventListener('change', (event) => {
    metaFileDownload(event.target.files)
});

const metaMap = new Set(['torrent', 'meta4', 'metalink']);

async function metaFileDownload(files) {
    aria2Config['out'] = aria2Config['referer'] = aria2Config['user-agent'] = null;
    let datas = [...files].map((file) => {
        let { name } = file;
        let type = name.slice(name.lastIndexOf('.') + 1);
        if (!metaMap.has(type)) {
            return;
        }
        return new Promise((resolve) => {
            let reader = new FileReader();
            reader.onload = (event) => {
                let { result } = reader;
                let body = result.slice(result.indexOf(',') + 1);
                let session = type === 'torrent'
                    ? { method: 'aria2.addTorrent', params: [body, [], aria2Config] }
                    : { method: 'aria2.addMetalink', params: [body, aria2Config] };
                resolve(session);
            };
            reader.readAsDataURL(file);
        });
    }).filter(Boolean);
    let params = await Promise.all(datas);
    chrome.runtime.sendMessage({ action: 'jsonrpc_download', params }, close);
}

jsonrpcPane.addEventListener('change', (event) => {
    let { name, value } = event.target;
    aria2Config[name] = value;
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
