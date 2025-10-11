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

function shortcutHandler(event, button) {
    if (event.ctrlKey) {
        event.preventDefault();
        button.click();
    }
}

const shortcutMap = {
    'a': (event) => shortcutHandler(event, selectAll),
    'e': (event) => shortcutHandler(event, selectNone),
    'f': (event) => shortcutHandler(event, selectFlip),
    'q': (event) => shortcutHandler(event, optionsBtn),
    'Enter': (event) => shortcutHandler(event, submitBtn),
    'Escape': () => close()
};

document.addEventListener('keydown', (event) => {
    shortcutMap[event.key]?.(event);
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
    aria2Images.forEach(({ src, alt, classList }) => {
        if (classList.contains('checked')) {
            let options = { ...aria2Config, out: alt };
            params.push({ method: 'aria2.addUri', params: [[src], options] });
        }
    });
    chrome.runtime.sendMessage({ action: 'jsonrpc_download', params }, close);
}

const menuEventMap = {
    'select_all': () => aria2Images.forEach((img) => img.classList.add('checked')),
    'select_none': () => aria2Images.forEach((img) => img.classList.remove('checked')),
    'select_flip': () => aria2Images.forEach((img) => img.classList.toggle('checked')),
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
    aria2Config['all-proxy'] = event.target.previousElementSibling.value = aria2Storage['proxy_server'];
});

chrome.runtime.sendMessage({ action: 'inspect_images' }, ({ storage, options, images, referer, tabId, manifest, request }) => {
    manifest.manifest_version === 2 ? aria2HeadersMV2(referer, tabId, request) : aria2HeadersMV3(referer, tabId);
    aria2Storage = storage;
    aria2Config['referer'] = referer;
    jsonrpcEntries.forEach((entry) => {
        entry.value = aria2Config[entry.name] = options[entry.name] ?? '';
    });
    images.forEach((url) => {
        let img = document.createElement('img');
        img.alt = url.slice(url.lastIndexOf('/') + 1).replace(/[?#@].*$/, '');
        img.src = img.title = url;
        aria2Images.push(img);
        galleryPane.appendChild(img);
    });
});

function aria2HeadersMV2(value, tabId, request) {
    request.unshift('blocking');
    chrome.webRequest.onBeforeSendHeaders.addListener(({ requestHeaders }) => {
        requestHeaders.push({ name: 'Referer', value });;
        return { requestHeaders };
    }, { urls: ['http://*/*', 'https://*/*'], tabId, types: ['image'] }, request);
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
