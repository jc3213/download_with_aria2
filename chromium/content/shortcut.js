document.addEventListener('click', event => {
    var {ctrlKey, altKey, target} = event;
    if (ctrlKey && altKey) {
        event.preventDefault();
        var download = getDownloadUrl(target);
        if (!download) {
            download = getDownloadUrl(target.parentNode);
        }
    }
});

function getDownloadUrl(node) {
    var {tagName, href, src, alt} = node;
    if (tagName === 'A') {
        startDownload(href);
        return true;
    }
    else if (tagName === 'IMG') {
        startDownload(src);
        return true;
    }
    return false;
}

function startDownload(url) {
    var type = 'download';
    var referer = location.href;
    var message = {url, options: {referer}};
    chrome.runtime.sendMessage({type, message});
}
