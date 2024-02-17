var referer = location.href;
var header = ['Cookie: ' + document.cookie];

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
            response({images: getAllImages(), options: {referer, header}});
            break;
    }
});

function getAllImages(archive = {}, result = []) {
    [...document.images].forEach((img) => {
        var {src, alt} = img;
        if (src === referer || src.startsWith('data') || src in archive) {
            return;
        }
        result.push({src, alt});
        archive[src] = alt;
    });
    return result;
}
