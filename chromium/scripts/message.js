var referer = location.href;
var header = ['Cookie: ' + document.cookie];
var history = {};
var result = [];
var getImage = true;

window.addEventListener('load', (event) => {
    window.postMessage({extension_name: 'Download With Aria2'});
});

window.addEventListener('message', (event) => {
    var {aria2c, params} = event.data;
    if (aria2c === 'aria2c-jsonrpc-call') {
        chrome.runtime.sendMessage({action: 'external_download', params});
    }
});

chrome.runtime.onMessage.addListener((message) => {
    switch (message) {
        case 'aria2c_all_images':
            getAllImages();
            break;
    }
});

function getAllImages() {
    if (getImage) {
        [...document.images].forEach((img) => {
            var {src, alt} = img;
            if (src === referer || src.startsWith('data') || history[src]) {
                return;
            }
            result.push({src, alt});
            history[src] = alt;
        });
        getImage = false;
    }
    var params = {result, options: {referer, header}};
    chrome.runtime.sendMessage({action: 'external_images', params});
}
