var viewer = document.querySelector('#viewer');
var submitbtn = document.querySelector('#submit_btn');
var optionsbtn = document.querySelector('#extra_btn');
var aria2Options;
var aria2Proxy;

document.addEventListener('keydown', (event) => {
    var {ctrlKey, altKey, key} = event;
    if (ctrlKey && key === 'Enter' || altKey && key === 's') {
        event.preventDefault();
        submitbtn.click();
    }
    else if (ctrlKey && key === 's') {
        event.preventDefault();
        optionsbtn.click();
    }
});

submitbtn.addEventListener('click', async (event) => {
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
});

optionsbtn.addEventListener('click', (event) => {
    document.body.classList.toggle('extra');
});

chrome.storage.local.get(null, (json) => {
    aria2Store = json;
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['jsonrpc_token']);
    aria2Proxy = aria2Store['proxy_server'];
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
    img.addEventListener('load', (event) => {
        img.title = `${img.offsetWidth}x${img.offsetHeight}`;
    });
    img.addEventListener('click', (event) => {
        img.className = img.className === '' ? 'checked' : '';
    });
    viewer.append(img);
}
