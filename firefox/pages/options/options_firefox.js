var [folderff, captureen, captureff, backBtn] = document.querySelectorAll('#folder_firefox, #capture_enabled, #capture_webrequest, [data-bid="back_btn"]');

folderff.parentNode.nextElementSibling.removeAttribute('class');

captureen.addEventListener('change', event => {
    if (!event.target.checked) {
        folderff.checked = changes['folder_firefox'] = false;
    }
});

captureff.addEventListener('change', event => {
    if (event.target.checked) {
        folderff.checked = changes['folder_firefox'] = false;
    }
});

backBtn.addEventListener('click', firefoxExclusive);

function firefoxExclusive() {
    entries['folder_firefox'].checked = changes['folder_firefox'];
    entries['capture_webrequest'].checked = changes['capture_webrequest'];
    optionsRelated(captureff);
    optionsRelated(folderff);
}

var observer = setInterval(() => {
    if (aria2Store) {
        clearInterval(observer);
        firefoxExclusive();
    }
}, 50);
