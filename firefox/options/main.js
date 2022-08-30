document.querySelector('iframe').addEventListener('load', async event => {
    var store = await browser.storage.local.get(null);
    var {os} = await browser.runtime.getPlatformInfo();
    var iframe = event.target.contentDocument;
    var danger = false;
    var i18n = {
        'en': {
            safe: 'Safe Mode',
            danger: 'Dangerous!',
            api: 'Capture API',
            browser: 'Browser'
        },
        'zh': {
            safe: '安全模式',
            danger: '危险！',
            api: '选择API',
            browser: '浏览器'
        }
    };
    var lang = browser.i18n.getUILanguage();
    i18n = i18n[lang] ?? i18n[lang.slice(0, lang.indexOf('-'))] ?? i18n['en'];

    var safe = document.createElement('button');
    safe.innerText = i18n['safe'];
    safe.style.display = '1,2'.includes(store['capture_mode']) ? 'inline-block' : 'none';
    safe.addEventListener('click', event =>  {
        if (confirm(i18n['danger'])) {
            danger = true;
            safe.style.display = 'none';
            api.style.display = 'block';
        }
    });

    var api = document.createElement('div');
    api.title = '';
    api.style.display = 'none';
    api.innerHTML = '<span class="title">' + i18n['api'] + '</span><select name="capture_api"><option value="0">downloads API</option><option value="1">webRequest API</option></select>';

    var sub = document.createElement('option');
    sub.value = '2';
    sub.innerText = i18n['browser'];

    var capture = iframe.querySelector('#option > div:nth-child(11)');
    capture.addEventListener('change', event => {
        if ('1,2'.includes(capture.value)) {
            if (danger) {
                api.style.display = 'block';
                safe.style.display = 'none';
            }
            else {
                safe.style.display = 'inline-block';
                api.style.display = 'none';
            }
        }
        else {
            safe.style.display = api.style.display = 'none';
        }
    });
    
    var folder = iframe.querySelector('#option > div:nth-child(5) > select');
    folder.append(sub);
    folder.value = store['folder_path'];

    capture.append(safe);
    capture.after(api);

    iframe.querySelector('.float').style.right = '37px';

    api.querySelector('select').value = store['capture_api'];
});
