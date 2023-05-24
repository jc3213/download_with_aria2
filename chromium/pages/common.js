document.querySelectorAll('[i18n]').forEach(item => {
    item.innerText = chrome.i18n.getMessage(item.innerText);
});

document.querySelectorAll('[title]').forEach(item => {
    item.title = chrome.i18n.getMessage(item.title);
});

var filesize = {
    'min-split-size': 1,
    'disk-cache': 1,
    'max-download-limit': 1,
    'max-overall-download-limit': 1,
    'max-upload-limit': 1,
    'max-overall-upload-limit': 1
};

NodeList.prototype.disposition = function (json) {
    var options = {};
    this.forEach(node => {
        var {id} = node;
        var value = json[id];
        if (!value) {
            return;
        }
        if (filesize[id]) {
            value = getFileSize(value);
        }
        node.value = options[id] = value;
    });
    return options;
}

function getFileSize(bytes) {
    if (isNaN(bytes)) {
        return '??';
    }
    else if (bytes < 1024) {
        return bytes;
    }
    else if (bytes < 1048576) {
        return `${(bytes / 10.24 | 0) / 100}K`;
    }
    else if (bytes < 1073741824) {
        return `${(bytes / 10485.76 | 0) / 100}M`;
    }
    else if (bytes < 1099511627776) {
        return `${(bytes / 10737418.24 | 0) / 100}G`;
    }
    else {
        return `${(bytes / 10995116277.76 | 0) / 100}T`;
    }
}
