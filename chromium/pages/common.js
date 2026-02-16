const hotkeys = {};

for (let el of document.querySelectorAll('[hotkey]')) {
    let combo = el.getAttribute('hotkey').toLowerCase();
    hotkeys[combo] = el;
}

for (let el of document.querySelectorAll('[i18n]')) {
    let i18n = el.getAttribute('i18n');
    el.textContent = chrome.i18n.getMessage(i18n);
}

for (let el of document.querySelectorAll('[i18n-tips]')) {
    let tips = el.getAttribute('i18n-tips')
    el.title = chrome.i18n.getMessage(tips);
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
    let combo = keys.join('+');
    let hotkey = hotkeys[combo];
    if (hotkey) {
        event.preventDefault();
        hotkey.click();
    }
});
