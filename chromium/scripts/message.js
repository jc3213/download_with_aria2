var referer = location.href;
var header = ['Cookie: ' + document.cookie];

window.addEventListener('message', (event) => {
    switch(event.data.aria2c) {
        case 'aria2c-jsonrpc-test':
            window.postMessage({extension_name: 'Download With Aria2', source: 'aria2c'});
            break;
        case 'aria2c-jsonrpc-call':
            aria2SendRPCCall(event.data.params);
            break;
    }
});

chrome.runtime.onMessage.addListener(({query}, sender, response) => {
    switch (query) {
        case 'aria2c_all_images':
            response({images: getAllImages(), options: {referer, header}});
            break;
    }
});

function aria2SendRPCCall(params) {
    if (params?.urls || params?.files?.torrents || params?.files?.metalinks) {
        chrome.runtime.sendMessage({action: 'message_download', params});
    }
}

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
