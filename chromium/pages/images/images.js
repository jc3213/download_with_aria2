var viewer = document.querySelector('#viewer');
var images = [];
var aria2Options;
var aria2Proxy;

document.addEventListener('keydown', (event) => {
    var {ctrlKey, altKey, key} = event;
    if (ctrlKey && key === 'Enter' || altKey && key === 's') {
        event.preventDefault();
        imagesSubmit();
    }
    else if (ctrlKey && key === 's') {
        event.preventDefault();
        imagesOptions();
    }
});

document.addEventListener('click', ({target}) => {
    var id = target.dataset.bid;
    if (id === 'submit_btn') {
        imagesSubmit();
    }
    else if (id === 'extra_btn') {
        imagesOptions();
    }
    else if (id === 'proxy_btn') {
        imagesProxy(target);
    }
    else if (id === 'select_all') {
        images.forEach(image => image.classList.add('checked'));
    }
    else if (id === 'select_none') {
        images.forEach(image => image.classList.remove('checked'));
    }
    else if (id === 'select_flip') {
        images.forEach(image => image.classList.toggle('checked'));
    }
});

async function imagesSubmit() {
    var json = [...viewer.querySelectorAll('.checked')].map(({src, alt}) => {
        var options = {...aria2Options};
        if (alt) {
            options['out'] = alt;
        }
        return {url: src, options};
    });
    if (json.length !== 0) {
        await aria2DownloadJSON(json);
    }
    close();
}

function imagesOptions() {
    document.body.classList.toggle('extra');
}

function imagesProxy(proxyBtn) {
    proxyBtn.previousElementSibling.value = aria2Options['all-proxy'] = aria2Storage['proxy_server'];
}

viewer.addEventListener('click', ({target}) => {
    if (target.tagName === 'IMG') {
        target.className = target.className === '' ? 'checked' : '';
    }
});

viewer.addEventListener('load', ({target}) => {
    target.title = `${target.offsetWidth}x${target.offsetHeight}`;
}, true);

chrome.storage.sync.get(null, (json) => {
    aria2Storage = json;
    aria2RPC = new Aria2(aria2Storage['jsonrpc_uri'], aria2Storage['jsonrpc_token']);
    aria2Proxy = aria2Storage['proxy_server'];
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
    viewer.append(img);
    images.push(img);
}
