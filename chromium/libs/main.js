var filesize = [
    'min-split-size',
    'disk-cache',
    'max-download-limit',
    'max-overall-download-limit',
    'max-upload-limit',
    'max-overall-upload-limit'
];

document.querySelectorAll('[i18n]').forEach(item => {
    item.innerText = chrome.i18n.getMessage(item.innerText);
});

document.querySelectorAll('[title]').forEach(item => {
    item.title = chrome.i18n.getMessage(item.title);
});

chrome.storage.local.get(null, json => {
    aria2Store = json;
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

function printGlobalOptions(json) {
    var options = {};
    document.querySelectorAll('[name]').forEach(entry => {
        var {name} = entry;
        var value = json[name] ?? '';
        if (filesize.includes(name)) {
            value = getFileSize(value);
        }
        if (value) {
            options[name] = value;
        }
        entry.value = value;
    });
    return options;
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
