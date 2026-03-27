const hotkeys = {};

for (let el of document.querySelectorAll('[i18n]')) {
    let i18n = el.getAttribute('i18n');
    el.textContent = chrome.i18n.getMessage(i18n);
}

for (let el of document.querySelectorAll('[i18n-tips]')) {
    let tips = el.getAttribute('i18n-tips')
    el.title = chrome.i18n.getMessage(tips);
}

for (let el of document.querySelectorAll('[hotkey]')) {
    let keys = el.getAttribute('hotkey').toLowerCase();
    while (true) {
        let i = keys.indexOf(';');
        if (i === -1) {
            let k = keys.trim();
            if (k) {
                hotkeys[k] = el;
            }
            break;
        } else {
            let k = keys.substring(0, i).trim();
            if (k) {
                hotkeys[k] = el;
            }
        }
        keys = keys.substring(i + 1);
    }
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
