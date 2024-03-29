var aria2Storage = {};
var aria2Global = {};
var result = [];
var logs = {};
var [preview, gallery] = document.querySelectorAll('#gallery, #preview > img');

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey) {
        switch (event.key) {
            case 'Enter':
                event.preventDefault();
                imagesSubmit();
                break;
            case 's':
                event.preventDefault();
                imagesOptions();
                break;
            case 'a':
                event.preventDefault();
                selectAll();
                break;
            case 'x':
                event.preventDefault();
                selectNone();
                break;
            case 'r':
                event.preventDefault();
                selectFlip();
                break;
        }
    }
});

document.addEventListener('click', (event) => {
    switch (event.target.dataset.bid) {
        case 'submit_btn':
            imagesSubmit();
            break;
        case 'extra_btn':
            imagesOptions();
            break;
        case 'proxy_btn':
            imagesProxy(event.target);
            break;
        case 'select_all':
            selectAll();
            break;
        case 'select_none':
            selectNone();
            break;
        case 'select_flip':
            selectFlip();
            break;
    }
});

async function imagesSubmit() {
    var urls = [];
    result.forEach(({src, alt, className}) => {
        if (className === 'checked') {
            urls.push({url: src, options: aria2Global});
        }
    });
    chrome.runtime.sendMessage({action: 'message_download', params: {urls}});
    close();
}

function imagesOptions() {
    document.body.classList.toggle('extra');
}

function imagesProxy(proxy) {
    proxy.previousElementSibling.value = aria2Global['all-proxy'] = aria2Storage['proxy_server'];
}

function selectAll() {
    result.forEach((img) => img.classList.add('checked'));
}

function selectNone() {
    result.forEach((img) => img.classList.remove('checked'));
}

function selectFlip() {
    result.forEach((img) => img.classList.toggle('checked'));
}

document.addEventListener('change', (event) => {
    var {dataset: {rid}, value} = event.target;
    aria2Global[rid] = value;
});

gallery.addEventListener('click', ({target}) => {
    if (target.tagName === 'IMG') {
        target.classList.toggle('checked');
    }
});

gallery.addEventListener('mouseenter', ({target}) => {
    if (target.tagName === 'IMG') {
        preview.src = target.src;
    }
}, true);

gallery.addEventListener('load', ({target}) => {
    target.alt = target.naturalWidth + 'x' + target.naturalHeight;
});

function getImagePreview(url) {
    var fixed = url.match(/[^?#@!]+/)[0];
    if (logs[fixed]) {
        return;
    }
    var img = document.createElement('img');
    img.src = url;
    result.push(img);
    gallery.append(img);
    logs[fixed] = true;
}

chrome.runtime.sendMessage({action: 'allimage_prompt'}, async ({storage, jsonrpc, params}) => {
    aria2Storage = storage;
    jsonrpc['user-agent'] = aria2Storage['user_agent'];
    aria2Global = document.querySelectorAll('#options input').disposition({...jsonrpc, ...params.options});
    params.result.forEach(getImagePreview);
});
