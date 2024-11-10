var aria2Storage = {};
var aria2Global = {};
var aria2Images = [];
var aria2Manifest = chrome.runtime.getManifest().manifest_version;

var [selectAll, selectNone, selectFlip, submitBtn, optionsBtn] = document.querySelectorAll('#menu > button');
var [preview, gallery] = document.querySelectorAll('#preview > img, #gallery');

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey) {
        switch (event.key) {
            case 'a':
                event.preventDefault();
                selectAll.click();
                break;
            case 'x':
                event.preventDefault();
                selectNone.click();
                break;
            case 'r':
                event.preventDefault();
                selectFlip.click();
                break;
            case 'Enter':
                event.preventDefault();
                submitBtn.click();
                break;
            case 's':
                event.preventDefault();
                optionsBtn.click();
                break;
        }
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
    var urls = [];
    aria2Images.forEach(({src, alt, header, classList}) => {
        if (classList.contains('checked')) {
            var options = {out: alt, header, ...aria2Global};
            urls.push({url: src, options});
        }
    });
    chrome.runtime.sendMessage({action: 'message_download', params: {urls}});
    close();
});

optionsBtn.addEventListener('click', (event) => {
    document.body.classList.toggle('extra');
});

document.getElementById('proxy').addEventListener('click', (event) => {
    event.target.previousElementSibling.value = aria2Global['all-proxy'] = aria2Storage['proxy_server'];
});

document.getElementById('options').addEventListener('change', (event) => {
    aria2Global[event.target.name] = event.target.value;
});

chrome.runtime.sendMessage({action: 'allimage_prompt'}, async ({storage, jsonrpc, params}) => {
    aria2Storage = storage;
    jsonrpc['user-agent'] = aria2Storage['headers_useragent'];
    aria2Global = document.querySelectorAll('#options input').disposition(jsonrpc);
    aria2Manifest === 2 ? aria2HeadersMV2(params) : aria2HeadersMV3(params);
    gallery.append(...aria2Images);
});

function getImagePreview(url, headers) {
    var img = document.createElement('img');
    img.src = img.title = url;
    img.header = headers.map(({name, value}) => name + ': ' + value);
    img.addEventListener('click', (event) => img.classList.toggle('checked'));
    img.addEventListener('load', (event) => getImageAlt(img, url));
    img.addEventListener('mouseenter', (event) => preview.src = url);
    aria2Images.push(img);
}

function getImageAlt(img, url) {
    var [full, name, ext = '.jpg'] = url.match(/(?:[@!])?(?:([\w-]+)(\.\w+)?)(?:\?.+)?$/);
    img.alt = name  + '_' + img.alt + '_' + img.naturalWidth + 'x' + img.naturalHeight + ext;
};

function aria2HeadersMV2({images, filter}) {
    var rules = {};
    images.forEach(({url, headers}) => {
        getImagePreview(url, headers);
        rules[url] = headers;
    });
    chrome.webRequest.onBeforeSendHeaders.addListener(({url}) => {
        return {requestHeaders: rules[url]};
    }, {urls: ['http://*/*', 'https://*/*'], types: ['image']}, ['blocking', ...filter]);
}

function aria2HeadersMV3({images}) {
    var addRules = [];
    images.forEach(({url, headers}, index) => {
        getImagePreview(url, headers);
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
