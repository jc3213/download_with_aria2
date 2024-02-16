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
    if (aria2c === 'aria2c-jsonrpc-call' && params !== undefined) {
        chrome.runtime.sendMessage({action: 'message_download', params});
    }
});

chrome.runtime.onMessage.addListener(({query}, sender, response) => {
    switch (query) {
        case 'aria2c_all_images':
            getAllImages();
            response({images: result, options: {referer, header}});
            break;
    }
});

function getAllImages() {
    if (!getImage) {
        return;
    }
    getImage = false;
    [...document.images].forEach((img) => {
        var {src, alt} = img;
        if (src === referer || src.startsWith('data') || history[src]) {
            return;
        }
        result.push({src, alt});
        history[src] = alt;
    });
}
