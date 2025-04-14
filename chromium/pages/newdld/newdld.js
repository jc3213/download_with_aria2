let aria2Storage = {};
let aria2Config = {};
let aria2Referer = [];

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

const shortcutHandlers = {
    'Enter': submitBtn
};

document.addEventListener('keydown', (event) => {
    let handler = shortcutHandlers[event.key];
    if (event.ctrlKey && handler) {
        event.preventDefault();
        handler.click();
    } else if (event.key === 'Escape') {
        close();
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
    chrome.runtime.sendMessage({ action: 'jsonrpc_download', params });
    close();
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

const metaFiles = {
    'torrent': {
        method: 'aria2.addTorrent',
        params: (body, options) => [body, [], options]
    },
    'metalink': {
        method: 'aria2.addMetalink',
        params: (body, options) => [body, options]
    }
}
metaFiles['meta4'] = metaFiles['metalink'];

async function metaFileDownload(files) {
    let options = {...aria2Config, out: null, referer: null, 'user-agent': null};
    let datas = [...files].map(async (file) => {
        let {name} = file;
        let type = name.slice(name.lastIndexOf('.') + 1);
        let metadata = metaFiles[type];
        if (metadata) {
            let body = await promiseFileReader(file);
            metadata.params = metadata.params(body, options);
            return { name, metadata };
        }
    })
    let params = (await Promise.all(datas)).filter((data) => data);
    chrome.runtime.sendMessage({ action: 'jsonrpc_metadata', params });
    close();
}

function promiseFileReader(file) {
    return new Promise((resolve) => {
        let reader = new FileReader();
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
    let entry = refererEntry.value;
    let regexp = new RegExp(entry.replace(/[.?/]/g, '\\$&'), 'gi');
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

document.getElementById('proxy').addEventListener('click', (event) => {
    aria2Config['all-proxy'] = event.target.previousElementSibling.value = aria2Storage['proxy_server'];
});

chrome.tabs.query({currentWindow: false}, (tabs) => {
    tabs.forEach((tab) => {
        if (tab.url.startsWith('http')) {
            let referer = document.createElement('div');
            referer.title = referer.textContent = tab.url;
            aria2Referer.push(referer);
            refererPane.appendChild(referer);
        }
    });
});

chrome.runtime.sendMessage({action: 'storage_query'}, ({storage, options}) => {
    aria2Storage = storage;
    jsonrpcEntries.forEach((entry) => {
        entry.value = aria2Config[entry.name] = options[entry.name] ?? '';
    });
});
