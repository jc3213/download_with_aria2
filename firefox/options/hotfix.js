if (location.search === '') {
    var css = document.createElement('style');
    css.innerText = 'input {width: 100%;}';
    document.head.append(css);
}

var danger = false;
var i18n = {
    'en': {
        safe: 'Safe Mode',
        danger: 'Dangerous!',
        api: 'Capture API',
        api_title: 'Set API used for capture browser downloads',
        browser: 'Browser'
    },
    'zh': {
        safe: '安全模式',
        danger: '危险！',
        api: '选择API',
        api_title: '设置用于抓取浏览器下载的API',
        browser: '浏览器'
    }
};
var lang = browser.i18n.getUILanguage();
i18n = i18n[lang] ?? i18n[lang.slice(0, lang.indexOf('-'))] ?? i18n['en'];

var safe = document.createElement('button');
safe.innerText = i18n['safe'];
safe.style.display = '1,2'.includes(aria2Store['capture_mode']) ? 'inline-block' : 'none';
safe.addEventListener('click', event =>  {
    if (confirm(i18n['danger'])) {
        danger = true;
        safe.style.display = 'none';
        api.style.display = 'block';
    }
});

var api = document.createElement('div');
api.title = i18n['api_title'];
api.style.display = 'none';
api.innerHTML = '<span class="title">' + i18n['api'] + '</span><select name="capture_api"><option value="0">downloads API</option><option value="1">webRequest API</option></select>';
api.addEventListener('change', event => {
    if (event.target.value === '1') {
        setDefaultFolder();
    }
    else {
        sub.style.display = 'block';
    }
});

var sub = document.createElement('option');
sub.value = '2';
sub.style.display = '1,2'.includes(aria2Store['capture_mode']) && aria2Store['capture_api'] === '0' ? 'block' : 'none';
sub.innerText = i18n['browser'];

var capture = document.querySelector('#option > div:nth-child(12)');
capture.addEventListener('change', event => {
    if ('1,2'.includes(event.target.value)) {
        if (danger) {
            api.style.display = 'block';
            safe.style.display = 'none';
        }
        else {
            safe.style.display = 'inline-block';
            api.style.display = 'none';
        }
        sub.style.display = 'block';
    }
    else {
        safe.style.display = api.style.display = 'none';
        setDefaultFolder();
    }
});
    
var folder = document.querySelector('#option > div:nth-child(5) > select');
folder.append(sub);
folder.value = aria2Store['folder_mode'];

capture.append(safe);
capture.after(api);

api.querySelector('select').value = aria2Store['capture_api'];
    
function setDefaultFolder() {
    if (folder.value === '2') {
        folder.value = '0';
        changes.push({name: 'folder_mode', old_value: '2', new_value: '0'});
    }
    sub.style.display = 'none';
}
