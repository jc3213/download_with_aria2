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

document.querySelectorAll('[i18n]').forEach(item => {
    item.innerText = chrome.i18n.getMessage(item.innerText);
});

document.querySelectorAll('[title]').forEach(item => {
    item.title = chrome.i18n.getMessage(item.title);
});

chrome.storage.local.get(null, json => {
    aria2Store = json;
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['jsonrpc_token']);
    aria2StartUp();
});

function getFileSize(bytes) {
    if (isNaN(bytes)) {
        return '?? ';
    }
    else if (bytes < 1024) {
        return bytes;
    }
    else if (bytes < 1048576) {
        return (bytes / 10.24 | 0) / 100 + 'K';
    }
    else if (bytes < 1073741824) {
        return (bytes / 10485.76 | 0) / 100 + 'M';
    }
    else if (bytes < 1099511627776) {
        return (bytes / 10737418.24 | 0) / 100 + 'G';
    }
    else {
        return (bytes / 10995116277.76 | 0) / 100 + 'T';
    }
}

function readFileTypeJSON(file) {
    return new Promise(resolve => {
        var reader = new FileReader();
        reader.onload = () => {
            var json = JSON.parse(reader.result);
            resolve(json);
        };
        reader.readAsText(file);
    });
}

function readFileForAria2(file) {
    return new Promise(resolve => {
        var reader = new FileReader();
        reader.onload = () => {
            var base64 = reader.result.slice(reader.result.indexOf(',') + 1);
            resolve(base64);
        };
        reader.readAsDataURL(file);
    });
}
