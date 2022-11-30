var i18n = {
    'en': {
        folderff: 'Follow Browser Behavior',
        folderff_title: 'Save files into browser defined directory',
        webrequest: 'Monitor Web Request',
        webrequest_title: 'Monitor web requests instead of capture browser downloads'
    },
    'zh': {
        folderff: '跟随浏览器',
        folderff_title: '将文件保存至浏览器下载目录',
        webrequest: '监听网络请求',
        webrequest_title: '监听网络请求而非抓取浏览器下载'
    }
};
var lang = browser.i18n.getUILanguage();
i18n = i18n[lang] ?? i18n[lang.slice(0, lang.indexOf('-'))] ?? i18n['en'];

var folderff = document.createElement('div');
folderff.title = i18n.folderff_title;
folderff.className = 'menu';
folderff.innerHTML = `<span class="title">${i18n.folderff}</span><input name="folder_firefox" type="checkbox">`;

var folderen = document.querySelector('[name="folder_enabled"]').parentNode;
folderen.addEventListener('change', event => {
    var {checked} = event.target;
    if (checked) {
        if (aria2Store['capture_webrequest']) {
            folderff.style.display = 'none';
        }
        else {
            folderff.style.display = 'block';
        }
    }
});

var container = document.createElement('div');
container.className = 'flex';
folderen.replaceWith(container);
container.append(folderen, folderff);

var webrequest = document.createElement('div');
webrequest.title = i18n.webrequest_title;
webrequest.className = 'menu';
webrequest.innerHTML = `<span class="title">${i18n.webrequest}</span><input name="capture_webrequest" type="checkbox">`;
webrequest.addEventListener('change', event => {
    var {checked} = event.target;
    if (checked) {
        setDefaultFolder();
    }
});

var captureen = document.querySelector('[name="capture_enabled"]').parentNode;
captureen.addEventListener('change', event => {
    var {checked} = event.target;
    if (!checked) {
        setDefaultFolder();
    }
});
captureen.parentNode.after(webrequest);

var checkfen = folderen.querySelector('input');
var checkfff = folderff.querySelector('input');
var checkcen = captureen.querySelector('input');
var checkcwr = webrequest.querySelector('input');

var folderde = document.querySelector('[name="folder_defined"]').parentNode;

checking['folder_firefox'] = 1;
checking['capture_webrequest'] = 1;
linkage['folder_firefox'] = [{menu: folderde, rule: 0}];
linkage['capture_enabled'].push({menu: webrequest, rule: 1}, {menu: folderff, rule: 1});
linkage['capture_webrequest'] = [{menu: folderff, rule: 0}];

function setDefaultFolder() {
    if (checkfff.checked) {
        changes.push({name: 'folder_firefox', old_value: true, new_value: false});
        checkfff.checked = false;
        if (checkfen.checked) {
            folderde.style.display = 'block';
        }
        else {
            folderde.style.display = 'none';
        }
    }
}

function firefoxExclusive() {
    checkfff.checked = aria2Store['folder_firefox'];
    checkcwr.checked = aria2Store['capture_webrequest'];
}

document.querySelector('#back_btn').addEventListener('click', firefoxExclusive);

var observer = setInterval(() => {
    if (aria2Store) {
        clearInterval(observer);
        firefoxExclusive();
    }
}, 50);
