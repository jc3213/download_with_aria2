document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.querySelectorAll('[i18n-title]').forEach((node) => {
    node.title = chrome.i18n.getMessage(node.getAttribute('i18n-title'));
});

NodeList.prototype.disposition = function (json) {
    var result = {};
    this.forEach((node) => {
        var value = json[node.name];
        if (value) {
            node.value = result[node.name] = value;
        }
    });
    return result;
}
