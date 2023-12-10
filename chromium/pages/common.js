document.querySelectorAll('[i18n]').forEach(item => {
    item.textContent = chrome.i18n.getMessage(item.textContent);
});

document.querySelectorAll('[title]').forEach(item => {
    item.title = chrome.i18n.getMessage(item.title);
});

if (typeof browser !== 'undefined') {
    chrome.storage.sync = browser.storage.local;
}

var filesize = {
    'min-split-size': true,
    'disk-cache': true,
    'max-download-limit': true,
    'max-overall-download-limit': true,
    'max-upload-limit': true,
    'max-overall-upload-limit': true
};

NodeList.prototype.disposition = function (json) {
    var result = {};
    this.forEach((node) => {
        var id = node.dataset.rid;
        var value = json[id];
        if (!value) {
            return;
        }
        if (filesize[id]) {
            value = getFileSize(value);
        }
        node.value = result[id] = value;
    });
    return result;
}

function getFileSize(bytes) {
    if (isNaN(bytes)) {
        return '??';
    }
    if (bytes < 1024) {
        return bytes;
    }
    if (bytes < 1048576) {
        return `${(bytes / 10.24 | 0) / 100}K`;
    }
    if (bytes < 1073741824) {
        return `${(bytes / 10485.76 | 0) / 100}M`;
    }
    if (bytes < 1099511627776) {
        return `${(bytes / 10737418.24 | 0) / 100}G`;
    }
    {
        return `${(bytes / 10995116277.76 | 0) / 100}T`;
    }
}
