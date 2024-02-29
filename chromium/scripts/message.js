window.addEventListener('message', (event) => {
    switch(event.data.aria2c) {
        case 'aria2c-jsonrpc-echo':
            aria2RPCEcho();
            break;
        case 'aria2c-jsonrpc-call':
            aria2RPCCall(event.data.params);
            break;
    }
});

function aria2RPCEcho() {
    window.postMessage({extension_name: 'Download With Aria2', source: 'aria2c'});
}

function aria2RPCCall(params) {
    if (params?.urls || params?.files?.torrents || params?.files?.metalinks) {
        chrome.runtime.sendMessage({action: 'message_download', params});
    }
}

chrome.runtime.onMessage.addListener(({query}, sender, response) => {
    switch (query) {
        case 'aria2c_all_images':
            response(queryAllImages());
            break;
    }
});

function queryAllImages(archive = {}, result = []) {
    document.querySelectorAll('img').forEach(({src, alt}) => {
        if (src === referer || src.startsWith('data') || src in archive) {
            return;
        }
        result.push({src, alt});
        archive[src] = alt;
    });
    return {images: result, options: {referer: location.href, header: ['Cookie: ' + document.cookie]}};
}
