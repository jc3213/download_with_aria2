var aria2Storage = {};
var aria2Global = {};
var aria2Images = [];
var aria2Manifest = chrome.runtime.getManifest().manifest_version;
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
        case 'options_btn':
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
    aria2Images.forEach(({src, alt, header, classList}) => {
        if (classList.contains('checked')) {
            var options = {'out': alt, header, ...aria2Global};
            urls.push({url: src, options});
        }
    });
    chrome.runtime.sendMessage({action: 'message_download', params: {urls}});
    close();
}

function imagesOptions() {
    document.body.classList.toggle('options');
}

function imagesProxy(proxy) {
    proxy.previousElementSibling.value = aria2Global['all-proxy'] = aria2Storage['proxy_server'];
}

function selectAll() {
    aria2Images.forEach((img) => img.classList.add('checked'));
}

function selectNone() {
    aria2Images.forEach((img) => img.classList.remove('checked'));
}

function selectFlip() {
    aria2Images.forEach((img) => img.classList.toggle('checked'));
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
    var [full, name, ext = '.jpg'] = target.src.match(/(?:[@!])?(?:([\w-]+)(\.\w+)?)(?:\?.+)?$/);
    target.alt = name  + '_' + target.alt + '_' + target.naturalWidth + 'x' + target.naturalHeight + ext;
}, true);

chrome.runtime.sendMessage({action: 'allimage_prompt'}, async ({storage, jsonrpc, params}) => {
    aria2Storage = storage;
    jsonrpc['user-agent'] = aria2Storage['headers_useragent'];
    aria2Global = document.querySelectorAll('#options input').disposition(jsonrpc);
    aria2Manifest === 2 ? aria2ManifestV2(params) : aria2ManifestV3(params.result);
    aria2Images.forEach((img) => gallery.append(img));
});

function getImagePreview(url, headers) {
    var img = document.createElement('img');
    img.src = img.title = url;
    img.header = headers.map(({name, value}) => name + ': ' + value);
    aria2Images.push(img);
}

function aria2ManifestV2({result, filter}) {
    var rules = {};
    result.forEach(({url, headers}) => {
        getImagePreview(url, headers);
        rules[url] = headers;
    });
    chrome.webRequest.onBeforeSendHeaders.addListener(({url}) => {
        return {requestHeaders: rules[url]};
    }, {urls: ['http://*/*', 'https://*/*'], types: ['image']}, ['blocking', ...filter]);
}

function aria2ManifestV3(result) {
    var addRules = [];
    result.forEach(({url, headers}, index) => {
        getImagePreview(url, header);
        addRules.push({
            id: index + 1,
            priority: 1,
            action: {
                type:'modifyHeaders',
                requestHeaders: headers.map(({name, value}) => ({header: name, operation: 'set', value}))
            },
            condition: {
                urlFilter: url,
                resourceTypes: ['image']
            }
        });
    });
    chrome.declarativeNetRequest.updateDynamicRules({addRules});
}
