const id = location.search.substring(1) | 0;

let aria2Proxy;
let aria2Config = {};
let aria2Images = [];

let [imagePane,, galleryPane,, menuPane, jsonrpcPane] = document.body.children;
let [selectAll, selectNone, selectFlip, submitBtn, optionsBtn] = menu.children;
let jsonrpcEntries = jsonrpcPane.querySelectorAll('[name]');
let preview = imagePane.children[0];

for (let i18n of document.querySelectorAll('[i18n]')) {
    i18n.textContent = chrome.i18n.getMessage(i18n.getAttribute('i18n'));
}

for (let i18n of document.querySelectorAll('[i18n-tips]')) {
    i18n.title = chrome.i18n.getMessage(i18n.getAttribute('i18n-tips'));
}

function ctrlHandler(event, button) {
    if (event.ctrlKey) {
        event.preventDefault();
        button.click();
    }
}

const hotkeyMap = {
    'KeyA': (event) => ctrlHandler(event, selectAll),
    'KeyE': (event) => ctrlHandler(event, selectNone),
    'KeyF': (event) => ctrlHandler(event, selectFlip),
    'KeyQ': (event) => ctrlHandler(event, optionsBtn),
    'Enter': (event) => ctrlHandler(event, submitBtn),
    'Escape': () => close()
};

document.addEventListener('keydown', (event) => {
    hotkeyMap[event.code]?.(event);
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

function menuEventSubmit() {
    let params = [];
    for (let { src, alt, classList } of aria2Images ) {
        if (classList.contains('checked')) {
            let options = { ...aria2Config, out: alt };
            params.push({ method: 'aria2.addUri', params: [[src], options] });
        }
    }
    chrome.runtime.sendMessage({ action: 'jsonrpc_download', params }, close);
}

const menuEventMap = {
    'select_all': () => {
        for (let img of aria2Images) {
            img.classList.add('checked');
        }
    },
    'select_none': () => {
        for (let img of aria2Images) {
            img.classList.remove('checked');
        }
    },
    'select_flip': () => {
        for (let img of aria2Images) {
            img.classList.toggle('checked');
        }
    },
    'common_submit': menuEventSubmit,
    'popup_options': () => jsonrpcPane.classList.toggle('hidden')
};

menuPane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n');
    menuEventMap[menu]?.();
});

jsonrpcPane.addEventListener('change', (event) => {
    aria2Config[event.target.name] = event.target.value;
});

document.getElementById('proxy').addEventListener('click', (event) => {
    aria2Config['all-proxy'] = event.target.previousElementSibling.value = aria2Proxy;
});

chrome.tabs.get(id, (tab) => {
    referer = tab.url;
});

chrome.tabs.getCurrent((tab) => {
    tabId = tab.id;
});

chrome.runtime.sendMessage({ action: 'inspect_images', params: id }, ({ storage, options, manifest, images, request }) => {
    manifest.manifest_version === 2 ? aria2HeadersMV2(request) : aria2HeadersMV3();
    aria2Proxy = storage['proxy_server'];
    aria2Config['referer'] = referer;
    for (let entry of jsonrpcEntries) {
        let { name } = entry;
        entry.value = aria2Config[name] = options[name] ?? '';
    }
    for (let src of images) {
        let img = document.createElement('img');
        img.alt = src.substring(src.lastIndexOf('/') + 1).replace(/[?#@].*$/, '');
        img.src = img.title = src;
        aria2Images.push(img);
        galleryPane.appendChild(img);
    }
});

function aria2HeadersMV2(request) {
    request.unshift('blocking');
    chrome.webRequest.onBeforeSendHeaders.addListener(({ requestHeaders }) => {
        requestHeaders.push({ name: 'Referer', value: referer });;
        return { requestHeaders };
    }, { urls: ['http://*/*', 'https://*/*'], tabId, types: ['image'] }, request);
}

function aria2HeadersMV3() {
    let addRules = [{
        id: 1,
        priority: 1,
        action: {
            type: 'modifyHeaders',
            requestHeaders: [{ header: "Referer", operation: "set", value: referer }]
        },
        condition: {
            tabIds: [tabId],
            resourceTypes: ['image']
        }
    }];
    chrome.declarativeNetRequest.updateSessionRules({ addRules, removeRuleIds: [1] });
}
