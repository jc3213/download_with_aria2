var [viewer, gallery] = document.querySelectorAll('#gallery, #viewer > img');
var images = [];
var aria2Options = {};

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
            imagesProxy(target);
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
    var json = [];
    images.forEach(({src, alt, classList}) => {
        if (classList.contains('checked')) {
            var options = {...aria2Options};
                if (alt) {
                options['out'] = alt;
            }
            json.push({url: src, options});
        }
    });
    if (json.length !== 0) {
        await aria2DownloadJSON(json);
    }
    close();
}

function imagesOptions() {
    document.body.classList.toggle('extra');
}

function imagesProxy(proxy) {
    proxy.previousElementSibling.value = aria2Options['all-proxy'] = aria2Storage['proxy_server'];
}

function selectAll() {
    images.forEach((image) => image.classList.add('checked'));
}

function selectNone() {
    images.forEach((image) => image.classList.remove('checked'));
}

function selectFlip() {
    images.forEach((image) => image.classList.toggle('checked'));
}

document.addEventListener('change', (event) => {
    var {dataset: {rid}, value} = event.target;
    aria2Options[rid] = value;
});

gallery.addEventListener('click', ({target}) => {
    if (target.tagName === 'IMG') {
        target.classList.toggle('checked');
    }
});

gallery.addEventListener('mouseenter', ({target}) => {
    if (target.tagName === 'IMG') {
        viewer.src = target.src;
    }
}, true);

chrome.storage.sync.get(null, (json) => {
    aria2Storage = json;
    aria2RPC = new Aria2(aria2Storage['jsonrpc_uri'], aria2Storage['jsonrpc_token']);
});

chrome.runtime.sendMessage({action: 'internal_images'}, async ({result, options}) => {
    result.forEach(getPreview);
    var global = await aria2RPC.call('aria2.getGlobalOption');
    aria2Options = document.querySelectorAll('#options input').disposition({...global, ...options});
});

function getPreview({src, alt, title}) {
    if (!src) {
        return;
    }
    var img = document.createElement('img');
    img.src = src;
    if (alt) {
        var path = src.slice(src.lastIndexOf('/'));
        var ix = path.lastIndexOf('.');
        var ext = ix === -1 ? '.jpg' : path.slice(ix);
        var ax = ext.indexOf('@');
        if (ax !== -1) {
            ext = ext.slice(0, ax);
        }
        img.alt = `${alt}${ext}`;
    }
    gallery.append(img);
    images.push(img);
}
