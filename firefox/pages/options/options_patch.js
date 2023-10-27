var i18n = {
    'en': {
        folderff: 'Follow Browser Behavior',
        folderff_title: 'Save files into browser defined directory',
        webrequest: 'Capture Web Requests',
        webrequest_title: 'Capture MIME "application" web requests instead of browser downloads'
    },
    'zh': {
        folderff: '浏览器下载文件夹',
        folderff_title: '将文件保存至浏览器所选择的下载文件夹',
        webrequest: '抓取网络请求',
        webrequest_title: '抓取MIME类型为"应用"的网络请求而非浏览器下载'
    }
};
var lang = chrome.i18n.getUILanguage();
i18n = i18n[lang] ?? i18n[lang.slice(0, lang.indexOf('-'))] ?? i18n['en'];

var folderff = document.createElement('div');
folderff.className = 'menu';
folderff.title = i18n.folderff_title;
folderff.dataset.rel = 'folder_enabled';
folderff.dataset.exc = 'capture_webrequest';
folderff.innerHTML = `<input id="folder_firefox" data-eid="folder_firefox" type="checkbox">\n<label for="folder_firefox">${i18n.folderff}</label>`;

var folderen = document.querySelector('#folder_enabled').parentNode;
folderen.nextElementSibling.removeAttribute('class');
folderen.after(folderff);

var webrequest = document.createElement('div');
webrequest.title = i18n.webrequest_title;
webrequest.className = 'menu';
webrequest.dataset.rel = 'capture_enabled';
webrequest.innerHTML = `<input id="capture_webrequest" data-eid="capture_webrequest" type="checkbox">\n<label for="capture_webrequest">${i18n.webrequest}</label>`;
webrequest.addEventListener('change', event => {
    if (event.target.checked) {
        folderff.querySelector('input').checked = changes['folder_firefox'] = false;
    }
});

var captureen = document.querySelector('#capture_enabled').parentNode;
captureen.addEventListener('change', event => {
    if (!event.target.checked) {
        folderff.querySelector('input').checked = changes['folder_firefox'] = false;
    }
});
captureen.after(webrequest);

entries['folder_firefox'] = folderff.querySelector('input');
entries['capture_webrequest'] = webrequest.querySelector('input');
switches['folder_firefox'] = switches['capture_webrequest'] = related['capture_webrequest'] = true;

function firefoxExclusive() {
    entries['folder_firefox'].checked = changes['folder_firefox'];
    entries['capture_webrequest'].checked = changes['capture_webrequest'];
    optionsRelated(webrequest);
    optionsRelated(folderff);
}

document.querySelector('[data-bid="back_btn"]').addEventListener('click', firefoxExclusive);

var observer = setInterval(() => {
    if (aria2Store) {
        clearInterval(observer);
        firefoxExclusive();
    }
}, 50);
