let aria2Storage = {};
let aria2Config = {};
let aria2Images = [];
let aria2Tab;

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
    let [, name, ext = '.jpg'] = img.src.match(/(?:[@!])?(?:([\w-]+)(\.\w+)?)(?:\?.+)?$/);
    img.alt = name  + '_' + img.alt + '_' + img.naturalWidth + 'x' + img.naturalHeight + ext;
}, true);

const menuEventHandlers = {
    'select_all': () => aria2Images.forEach((img) => img.classList.add('checked')),
    'select_none': () => aria2Images.forEach((img) => img.classList.remove('checked')),
    'select_flip': () => aria2Images.forEach((img) => img.classList.toggle('checked')),
    'common_submit': menuEventSubmit,
    'popup_options': () => document.body.classList.toggle('extra')
};

function menuEventSubmit() {
    let params = [];
    aria2Images.forEach(({src, alt, header, classList}) => {
        if (classList.contains('checked')) {
            params.push({ url: src, options: {...aria2Config, out: alt} });
        }
    });
    chrome.runtime.sendMessage({action: 'jsonrpc_download', params});
    close();
}

menuPane.addEventListener('click', (event) => {
    let handler = menuEventHandlers[event.target.getAttribute('i18n')];
    if (handler) {
        handler();
    }
});

jsonrpcPane.addEventListener('change', (event) => {
    aria2Config[event.target.name] = event.target.value;
});

document.getElementById('proxy').addEventListener('click', (event) => {
    aria2Config['all-proxy'] = event.target.previousElementSibling.value = aria2Storage['proxy_server'];
});

chrome.tabs.query({currentWindow: true, active: true}, (tabs) => {
    aria2Tab = tabs[0].id;
});

chrome.runtime.sendMessage({action: 'open_all_images'}, ({storage, options, images, referer, manifest, request}) => {
    aria2Storage = storage;
    options['referer'] = referer;
    manifest.manifest_version === 2 ? aria2HeadersMV2(referer, request) : aria2HeadersMV3(referer);
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

function aria2HeadersMV2(value, request) {
    chrome.webRequest.onBeforeSendHeaders.addListener(({requestHeaders}) => {
        requestHeaders.push({ name: 'Referer', value });;
        return {requestHeaders};
    }, {urls: ['http://*/*', 'https://*/*'], tabId: aria2Tab, types: ['image']}, ['blocking', ...request]);
}

function aria2HeadersMV3(value) {
    let addRules = [{
        id: 1,
        priority: 1,
        action: {
            type: 'modifyHeaders',
            requestHeaders: [{ header: "Referer", operation: "set", value }]
        },
        condition: {
            tabIds: [aria2Tab],
            resourceTypes: ['image']
        }
    }];
    chrome.declarativeNetRequest.updateSessionRules({ addRules, removeRuleIds: [1] });
}
