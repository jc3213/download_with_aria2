const hotkeys = {};

for (let hotkey of document.querySelectorAll('[hotkey]')) {
    let keys = hotkey.getAttribute('hotkey');
    hotkeys[keys] = hotkey;
}

for (let i18n of document.querySelectorAll('[i18n]')) {
    i18n.textContent = chrome.i18n.getMessage(i18n.getAttribute('i18n'));
}

for (let i18n of document.querySelectorAll('[i18n-tips]')) {
    i18n.title = chrome.i18n.getMessage(i18n.getAttribute('i18n-tips'));
}

document.addEventListener('keydown', (event) => {
    let { ctrlKey, altKey, shiftKey, key } = event;
    let keys = [];
    if (ctrlKey) {
        keys.push('ctrl');
    }
    if (altKey) {
        keys.push('alt');
    }
    if (shiftKey) {
        keys.push('shift');
    }
    keys.push(key.toLowerCase());
    let hotkey = hotkeys[keys.join('+')];
    if (hotkey) {
        event.preventDefault();
        hotkey.click();
    }
});
