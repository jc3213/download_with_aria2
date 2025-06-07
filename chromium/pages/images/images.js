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

function shortcutHandler(event, ctrlKey, button) {
    if (ctrlKey) {
        event.preventDefault();
        button.click();
    }
}

document.addEventListener('keydown', (event) => {
    let {key, ctrlKey} = event;
    switch (key) {
        case 'a':
            shortcutHandler(event, ctrlKey, selectAll);
            break;
        case 'e':
            shortcutHandler(event, ctrlKey, selectNone);
            break;
        case 'f':
            shortcutHandler(event, ctrlKey, selectFlip);
            break;
        case 's':
            shortcutHandler(event, ctrlKey, optionsBtn);
            break;
        case 'Enter':
            shortcutHandler(event, ctrlKey, submitBtn);
            break;
        case 'Escape':
            close();
            break;
    };
});

galleryPane.addEventListener('click', (event) => {
    if (event.target.localName === 'img') {
        event.target.classList.toggle('checked');
    }
});

galleryPane.addEventListener('mouseover', (event) => {
    if (event.target.localName === 'img') {
        preview.src = event.target.src;
    }
});

galleryPane.addEventListener('load', (event) => {
    let img = event.target;
    let {alt, naturalHeight, naturalWidth, src} = img;
    let [, name, type = '.jpg'] = src.match(/(?:[@!])?(?:([\w-]+)(\.\w+)?)(?:\?.+)?$/);
    img.alt = name + '_' + alt + '_' + naturalWidth + 'x' + naturalHeight + type;
}, true);

function menuEventSubmit() {
    let params = [];
    aria2Images.forEach(({src, alt, header, classList}) => {
        if (classList.contains('checked')) {
            params.push({ url: src, options: {...aria2Config, out: alt} });
        }
    });
    chrome.runtime.sendMessage({action: 'jsonrpc_download', params}, close);
}

menuPane.addEventListener('click', (event) => {
    let button = event.target.getAttribute('i18n');
    if (!button) {
        return;
    }
    switch (button) {
        case 'select_all':
            aria2Images.forEach((img) => img.classList.add('checked'));
            break;
        case 'select_none':
            aria2Images.forEach((img) => img.classList.remove('checked'));
            break;
        case 'select_flip':
            aria2Images.forEach((img) => img.classList.toggle('checked'));
            break;
        case 'common_submit':
            menuEventSubmit();
            break;
        case 'popup_options':
            document.body.classList.toggle('extra');
            break;
    };
});

jsonrpcPane.addEventListener('change', (event) => {
    aria2Config[event.target.name] = event.target.value;
});

document.getElementById('proxy').addEventListener('click', (event) => {
    aria2Config['all-proxy'] = event.target.previousElementSibling.value = aria2Storage['proxy_server'];
});

chrome.runtime.sendMessage({action: 'open_all_images'}, ({storage, options, images, referer, tabId, manifest, request}) => {
    aria2Storage = storage;
    options['referer'] = referer;
    manifest.manifest_version === 2 ? aria2HeadersMV2(referer, tabId, request) : aria2HeadersMV3(referer, tabId);
    jsonrpcEntries.forEach((entry) => {
        entry.value = aria2Config[entry.name] = options[entry.name] ?? '';
    });
    images.forEach((url) => {
        let img = document.createElement('img');
        img.src = img.title = url;
        aria2Images.push(img);
        galleryPane.appendChild(img);
    });
});

function aria2HeadersMV2(value, tabId, request) {
    chrome.webRequest.onBeforeSendHeaders.addListener(({requestHeaders}) => {
        requestHeaders.push({ name: 'Referer', value });;
        return {requestHeaders};
    }, {urls: ['http://*/*', 'https://*/*'], tabId, types: ['image']}, ['blocking', ...request]);
}

function aria2HeadersMV3(value, tabId) {
    let addRules = [{
        id: 1,
        priority: 1,
        action: {
            type: 'modifyHeaders',
            requestHeaders: [{ header: "Referer", operation: "set", value }]
        },
        condition: {
            tabIds: [tabId],
            resourceTypes: ['image']
        }
    }];
    chrome.declarativeNetRequest.updateSessionRules({ addRules, removeRuleIds: [1] });
}
