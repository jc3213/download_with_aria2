var viewer = document.querySelector('#viewer');
var submitbtn = document.querySelector('#submit_btn');
var aria2Options = {};
var aria2Proxy;

document.addEventListener('keydown', event => {
    var {ctrlKey, altKey, keyCode} = event;
    if (altKey) {
        if (keyCode === 83) {
            event.preventDefault();
            submitbtn.click();
        }
    }
    else if (ctrlKey) {
        if (keyCode === 13) {
            event.preventDefault();
            submitbtn.click();
        }
    }
});

chrome.runtime.sendMessage({action: 'internal_images'}, images => {
    var {result, options} = images;
    result.forEach(getPreview);
    aria2Options = options;
});

submitbtn.addEventListener('click', async event => {
    var json = [...viewer.querySelectorAll('.checked')].map(img => {
        var {src, alt} = img;
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

document.querySelector('#proxy_btn').addEventListener('click', event => {
    var {classList} = event.target;
    aria2Options['all-proxy'] = classList.contains('checked') ? null : aria2Proxy;
    classList.toggle('checked');
});

chrome.storage.local.get(null, json => {
    aria2Store = json;
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['jsonrpc_token']);
    aria2Proxy = aria2Store['proxy_server'];
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
    img.addEventListener('load', event => {
        img.title = `${img.offsetWidth}x${img.offsetHeight}`;
    });
    img.addEventListener('click', event => {
        img.className = img.className === '' ? 'checked' : '';
    });
    viewer.append(img);
}
