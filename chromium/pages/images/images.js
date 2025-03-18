let aria2Storage = {};
let aria2Config = {};
let aria2Images = [];

let [imagePane,, galleryPane,, menuPane, jsonrpcPane] = document.body.children;
let [selectAll, selectNone, selectFlip, submitBtn, optionsBtn] = menu.children;
let jsonrpcEntries = jsonrpcPane.querySelectorAll('[name]');
let preview = imagePane.children[0];

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.querySelectorAll('[i18n-tips]').forEach((node) => {
    node.title = chrome.i18n.getMessage(node.getAttribute('i18n-tips'));
});

const shortcutHandlers = {
    'a': selectAll,
    'e': selectNone,
    'f': selectFlip,
    's': optionsBtn,
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

selectAll.addEventListener('click', (event) => {
    aria2Images.forEach((img) => img.classList.add('checked'));
});

selectNone.addEventListener('click', (event) => {
    aria2Images.forEach((img) => img.classList.remove('checked'));
});

selectFlip.addEventListener('click', (event) => {
    aria2Images.forEach((img) => img.classList.toggle('checked'));
});

submitBtn.addEventListener('click', (event) => {
    let params = [];
    aria2Images.forEach(({src, alt, header, classList}) => {
        if (classList.contains('checked')) {
            params.push({ url: src, options: {out: alt, header, ...aria2Config} });
        }
    });
    chrome.runtime.sendMessage({action: 'jsonrpc_download', params});
    close();
});

optionsBtn.addEventListener('click', (event) => {
    document.body.classList.toggle('extra');
});

jsonrpcPane.addEventListener('change', (event) => {
    aria2Config[event.target.name] = event.target.value;
});

document.getElementById('proxy').addEventListener('click', (event) => {
    aria2Config['all-proxy'] = event.target.previousElementSibling.value = aria2Storage['proxy_server'];
});

chrome.runtime.sendMessage({action: 'open_all_images'}, ({storage, options, images, manifest, filter}) => {
    aria2Storage = storage;
    manifest.manifest_version === 2 ? aria2HeadersMV2(images, filter) : aria2HeadersMV3(images);
    galleryPane.append(...aria2Images);
    jsonrpcEntries.forEach((entry) => {
        entry.value = aria2Config[entry.name] = options[entry.name] ?? '';
    });
});

function getImagePreview(url, headers) {
    let img = document.createElement('img');
    img.src = img.title = url;
    img.header = headers.map(({name, value}) => name + ': ' + value);
    img.addEventListener('click', (event) => {
        img.classList.toggle('checked');
    });
    img.addEventListener('load', (event) => {
        let [, name, ext = '.jpg'] = url.match(/(?:[@!])?(?:([\w-]+)(\.\w+)?)(?:\?.+)?$/);
        img.alt = name  + '_' + img.alt + '_' + img.naturalWidth + 'x' + img.naturalHeight + ext;
    });
    img.addEventListener('mouseenter', (event) => {
        preview.src = url;
    });
    aria2Images.push(img);
}

function aria2HeadersMV2(images, filter) {
    let rules = {};
    images.forEach(({url, headers}) => {
        getImagePreview(url, headers);
        rules[url] = headers;
    });
    chrome.webRequest.onBeforeSendHeaders.addListener(({url}) => {
        return {requestHeaders: rules[url]};
    }, {urls: ['http://*/*', 'https://*/*'], types: ['image']}, ['blocking', ...filter]);
}

function aria2HeadersMV3(images) {
    let addRules = [];
    images.forEach(({url, headers}, index) => {
        getImagePreview(url, headers);
        addRules.push({
            id: index,
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
