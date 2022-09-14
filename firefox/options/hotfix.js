if (location.search === '') {
    var css = document.createElement('style');
    css.innerText = 'input, textarea {width: 100%;} hr {margin: 10px 0px;}';
    document.head.append(css);
}

var i18n = {
    'en': {
        api: 'Capture API',
        api_title: 'Set API used for capture browser downloads',
        browser: 'Browser'
    },
    'zh': {
        api: '选择API',
        api_title: '设置用于抓取浏览器下载的API',
        browser: '浏览器'
    }
};
var lang = browser.i18n.getUILanguage();
i18n = i18n[lang] ?? i18n[lang.slice(0, lang.indexOf('-'))] ?? i18n['en'];

var sub = document.createElement('option');
sub.value = '2';
sub.innerText = i18n['browser'];

var folder = document.querySelector('#option [name="folder_mode"]');
folder.append(sub);

var api = document.createElement('div');
api.title = i18n['api_title'];
api.innerHTML = '<span class="title">' + i18n['api'] + '</span><select name="capture_api"><option value="0">downloads API</option><option value="1">webRequest API</option></select>';
api.addEventListener('change', event => {
    if (event.target.value === '1') {
        setDefaultFolder();
    }
    else {
        sub.style.display = 'block';
    }
});

var capture = document.querySelector('#option [name="capture_mode"]');
capture.parentNode.after(api);
capture.addEventListener('change', event => {
    if ('1,2'.includes(capture.value)) {
        sub.style.display = 'block';
    }
    else {
        setDefaultFolder();
    }
});

document.querySelector('#back_btn').addEventListener('click', firefoxExclusive);

linkage['capture_mode'].push({menu: api, rule: '1,2'}, {menu: sub, rule: '1,2'});
linkage['capture_api'] = [{menu: sub, rule: '0'}];

function setDefaultFolder() {
    if (folder.value === '2') {
        changes.push({name: 'folder_mode', old_value: '2', new_value: '0'});
        folder.value = '0';
    }
    sub.style.display = 'none';
}

function firefoxExclusive() {
    api.querySelector('select').value = aria2Store['capture_api'];
    sub.style.display = aria2Store['capture_api'] === '0' && '1,2'.includes(aria2Store['capture_mode']) ? 'block' : 'none';
}

var observer = setInterval(() => {
    if (aria2Store) {
        clearInterval(observer);
        firefoxExclusive();
    }
}, 50);
