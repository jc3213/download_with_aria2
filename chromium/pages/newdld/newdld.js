let aria2Storage = {};
let aria2Config = {};
let aria2Referer = new Map();

let [menuPane, downEntry, metaPane, metaImport, jsonrpcPane] = document.body.children;
let [, downMode, submitBtn] = menuPane.children;
let refererPane = document.getElementById('referer');
let [refererEntry, ...jsonrpcEntries] = jsonrpcPane.querySelectorAll('[name]');

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.querySelectorAll('[i18n-tips]').forEach((node) => {
    node.title = chrome.i18n.getMessage(node.getAttribute('i18n-tips'));
});

const shortcutMap = {
    'Enter': submitBtn,
    'Tab': downMode,
    'Escape': close
}

document.addEventListener('keydown', (event) => {
    let key = shortcutMap[event.key];
    if (!key) {
        return;
    }
    if (event.ctrlKey) {
        event.preventDefault();
        key.click();
    } else {
        key();
    }
});

document.addEventListener('click', (event) => {
    if (event.target !== refererEntry && refererPane.style.display === 'block') {
        refererPane.style.display = ''; 
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
    let params = urls.map((url) => ({ url, options: aria2Config }));
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

async function metafileHandler(file, method, ...params) {
    return new Promise((resolve) => {
        let reader = new FileReader();
        reader.onload = (event) => {
            let body = reader.result.slice(reader.result.indexOf(',') + 1);
            params.unshift(body);
            resolve({ name: file.name, data: { method, params } });
        };
        reader.readAsDataURL(file);
    });
}

const metafileMap = {
    'torrent': (file, options) => metafileHandler(file, 'aria2.addTorrent', [], options),
    'meta4': (file, options) => metafileHandler(file, 'aria2.addMetalink', options),
    'metalink': (file, options) => metafileHandler(file, 'aria2.addMetalink', options)
};

async function metaFileDownload(files) {
    let options = {...aria2Config, out: null, referer: null, 'user-agent': null};
    let datas = [...files].map((file) => {
        let [ type ] = file.name.match(/[^.]+$/);
        return metafileMap[type]?.(file, options);
    });
    let params = (await Promise.all(datas)).filter((data) => data);
    chrome.runtime.sendMessage({ action: 'jsonrpc_metadata', params }, close);
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
    let entry = refererEntry.value;
    let regexp = new RegExp(entry.replace(/[.?/]/g, '\\$&'), 'gi');
    aria2Referer.values().forEach((referer) => {
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

document.getElementById('proxy').addEventListener('click', (event) => {
    aria2Config['all-proxy'] = event.target.previousElementSibling.value = aria2Storage['proxy_server'];
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
    tabs.forEach(({id, url}) => {
        refererModalList(id, url);
    });
});

chrome.tabs.onUpdated.addListener((tabId, {url}) => {
    if (url) {
        refererModalList(tabId, url);
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    let referer = aria2Referer.get(tabId);
    if (referer) {
        referer.remove();
        aria2Referer.delete(tabId);
    }
});


chrome.runtime.sendMessage({action: 'system_runtime'}, ({storage, options}) => {
    aria2Storage = storage;
    jsonrpcEntries.forEach((entry) => {
        entry.value = aria2Config[entry.name] = options[entry.name] ?? '';
    });
});
