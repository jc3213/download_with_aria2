document.querySelectorAll('[i18n]').forEach(item => {
    item.innerText = browser.i18n.getMessage(item.innerText);
});

document.querySelectorAll('[i18n_title]').forEach(item => {
    item.title = browser.i18n.getMessage(item.title);
});
