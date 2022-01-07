document.querySelectorAll('[i18n]').forEach(item => {
    item.innerText = chrome.i18n.getMessage(item.innerText);
});

document.querySelectorAll('[i18n_title]').forEach(item => {
    item.title = chrome.i18n.getMessage(item.title);
});

function readFileAsBinary(file, resolve) {
    var reader = new FileReader();
    reader.onload = () => resolve(reader.result.slice(reader.result.indexOf(',') + 1));
    reader.readAsDataURL(file);
}

function bytesToFileSize(bytes) {
    return bytes < 0 ? '?? B' : bytes < 1024 ? bytes + ' B' :
        bytes < 1048576 ? (bytes / 10.24 | 0) / 100 + ' KB' :
        bytes < 1073741824 ? (bytes / 10485.76 | 0) / 100 + ' MB' :
        bytes < 1099511627776 ? (bytes / 10737418.24 | 0) / 100 + ' GB' : (bytes / 10995116277.76 | 0) / 100 + ' TB';
}

function printButton() {
    document.querySelectorAll('[data-feed]').forEach(button => {
        var rule = button.getAttribute('data-feed').match(/[^,]+/g);
        var name = rule[0], root = rule[1];
        var field = button.parentNode.querySelector('input');
        button.addEventListener('click', event => {
            field.value = root in aria2RPC ? aria2RPC[root][name] : aria2RPC[name];
        });
    });
}

function printOptions(options) {
    document.querySelectorAll('input[name]:not([id])').forEach(field => {
        field.value = options[field.name] ?? '';
        if (field.hasAttribute('size')) {
            var size = bytesToFileSize(field.value);
            field.value = size.slice(0, size.indexOf(' ')) + size.slice(size.indexOf(' ') + 1, -1);
        }
    });
}
