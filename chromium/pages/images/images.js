const id = location.search.substring(1) | 0;
const gallery = [];

let aria2Proxy;
let aria2Config = {};

let [imagePane,, thumbPane,, menuPane, jsonrpcPane] = document.body.children;
let jsonrpcEntries = jsonrpcPane.querySelectorAll('[name]');
let preview = imagePane.firstElementChild;
let optionsBtn = menuPane.lastElementChild;

thumbPane.addEventListener('click', (event) => {
    if (event.target.localName === 'img') {
        event.target.classList.toggle('checked');
    }
});

thumbPane.addEventListener('mouseover', (event) => {
    if (event.target.localName === 'img') {
        preview.src = event.target.src;
    }
});

function menuEventSubmit() {
    let params = [];
    for (let { src, alt, classList } of gallery) {
        if (classList.contains('checked')) {
            let options = { ...aria2Config, out: alt };
            params.push({ method: 'aria2.addUri', params: [[src], options] });
        }
    }
    chrome.runtime.sendMessage({ action: 'remote_download', params }, close);
}

const menuEvents = {
    'select_all': () => {
        for (let img of gallery) {
            img.classList.add('checked');
        }
    },
    'select_none': () => {
        for (let img of gallery) {
            img.classList.remove('checked');
        }
    },
    'select_flip': () => {
        for (let img of gallery) {
            img.classList.toggle('checked');
        }
    },
    'common_submit': menuEventSubmit,
    'popup_options': () => {
        optionsBtn.classList.toggle('checked');
        jsonrpcPane.classList.toggle('hidden');
    }
};

menuPane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n');
    menuEvents[menu]?.();
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

chrome.runtime.sendMessage({ action: 'images_runtime', params: id }, ({ system, storage, options, images, headers }) => {
    system.manifest_version === 2 ? antiLeechMV2(headers) : antiLeechMV3();
    aria2Proxy = storage['proxy_server'];
    aria2Config['referer'] = referer;
    for (let entry of jsonrpcEntries) {
        let { name } = entry;
        entry.value = aria2Config[name] = options[name] ?? '';
    }
    for (let url of images) {
        let path = url.substring(url.lastIndexOf('/') + 1);
        let idx = path.search(/[?#@]/);
        let img = document.createElement('img');
        img.alt = idx === -1 ? path : path.substring(0, idx);
        img.src = img.title = url;
        thumbPane.appendChild(img);
        gallery.push(img);
    }
});

function antiLeechMV2(headers) {
    headers.unshift('blocking');
    chrome.webRequest.onBeforeSendHeaders.addListener(({ requestHeaders }) => {
        requestHeaders.push({ name: 'Referer', value: referer });;
        return { requestHeaders };
    }, { urls: ['http://*/*', 'https://*/*'], tabId, types: ['image'] }, headers);
}

function antiLeechMV3() {
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
