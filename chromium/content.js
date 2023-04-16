window.addEventListener('load', event => {
    window.postMessage({extension_name: 'Download With Aria2'});
});

window.addEventListener('message', event => {
    var {aria2c, download} = event.data;
    if (aria2c === 'Download With Aria2' && download !== undefined) {
        chrome.runtime.sendMessage({action: 'external_download', params: download});
    }
});

chrome.runtime.onMessage.addListener(message => {
    if (message === 'download_all_images') {
        getAllImages();
    }
});

function getAllImages() {
    var referer = location.href;
    var header = ['Cookie: ' + document.cookie];
    var result = [];
    document.querySelectorAll('img').forEach(img => {
        var {src, alt} = img;
        if (src === referer || src.startsWith('data')) {
            return;
        }
        var dup = result.find(i => i.src === src);
        if (dup === undefined) {
            result.push({src, alt});
        }
    });
    var params = {result, options: {referer, header}};
    chrome.runtime.sendMessage({action: 'external_images', params});
}
