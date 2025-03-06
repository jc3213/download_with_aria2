var aria2Storage = {};
var aria2Config = {};
var aria2Images = [];

var [selectAll, selectNone, selectFlip, submitBtn, optionsBtn, proxyBtn] = document.querySelectorAll('button');
var [preview, galleryPane, jsonrpcPane] = document.querySelectorAll('#preview > img, #gallery, #jsonrpc');
var jsonrpcEntries = document.querySelectorAll('#jsonrpc [name]');

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.querySelectorAll('[i18n-tips]').forEach((node) => {
    node.title = chrome.i18n.getMessage(node.getAttribute('i18n-tips'));
});

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
            case 'f':
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
    } else {
        switch (event.key) {
            case 'Escape':
                close();
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
    var params = [];
    aria2Images.forEach(({src, alt, header, classList}) => {
        if (classList.contains('checked')) {
            var options = {out: alt, header, ...aria2Config};
            params.push({url: src, options});
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

proxyBtn.addEventListener('click', (event) => {
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

function aria2HeadersMV2(images, filter) {
    var rules = {};
    images.forEach(({url, headers}) => {
        getImagePreview(url, headers);
        rules[url] = headers;
    });
    chrome.webRequest.onBeforeSendHeaders.addListener(({url}) => {
        return {requestHeaders: rules[url]};
    }, {urls: ['http://*/*', 'https://*/*'], types: ['image']}, ['blocking', ...filter]);
}

function aria2HeadersMV3(images) {
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
