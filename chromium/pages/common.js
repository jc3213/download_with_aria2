document.querySelectorAll('[i18n]').forEach(item => {
    if (item.title !== '') {
        item.title = chrome.i18n.getMessage(item.title);
        return;
    }
    item.textContent = chrome.i18n.getMessage(item.textContent);
});

NodeList.prototype.disposition = function (json) {
    var result = {};
    this.forEach((node) => {
        var id = node.dataset.rid;
        var value = json[id];
        if (value) {
            node.value = result[id] = value;
        }
    });
    return result;
}
