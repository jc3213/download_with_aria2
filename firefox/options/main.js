document.querySelector('iframe').addEventListener('load', async event => {
    var store = await browser.storage.local.get(null);
    var {os} = await browser.runtime.getPlatformInfo();
    var danger = false;
    var i18n = {
        'en': {
            safe: 'Safe Mode',
            danger: 'Dangerous!',
            api: 'Capture API',
            folder: 'Capture Download Folder',
            '0': 'Default',
            '1': 'Browser',
            '2': 'Custom Folder'
        },
        'zh': {
            safe: '安全模式',
            danger: '危险！',
            api: '选择API',
            folder: '抓取下载文件夹',
            '0': '默认',
            '1': '浏览器',
            '2': '自定义'
        }
    };
    var lang = browser.i18n.getUILanguage();
    i18n = i18n[lang] ?? i18n[lang.slice(0, lang.indexOf('-'))] ?? i18n['en'];

    var iframe = event.target.contentDocument;

    var capture = iframe.querySelector('select[name="capture_mode"]');
    capture.addEventListener('change', event => {
        if (['1', '2'].includes(capture.value)) {
            if (danger) {
                api.style.display = folder.style.display = custom.style.display = 'block';
                safe.style.display = 'none';
            }
            else {
                safe.style.display = 'inline-block';
                api.style.display = folder.style.display = custom.style.display = 'none';
            }
        }
        else {
            safe.style.display = api.style.display = folder.style.display = custom.style.display = 'none';
        }
    });

    var safe = document.createElement('button');
    safe.innerText = i18n['safe'];
    safe.style.display = ['1', '2'].includes(capture.value) ? 'inline-block' : 'none';
    safe.addEventListener('click', event =>  {
        if (confirm(i18n['danger'])) {
            danger = true;
            safe.style.display = 'none';
            api.style.display = 'block';
            if (store['capture_api'] === '0') {
                folder.style.display = 'block';
            }
            if (store['folder_mode'] === '2') {
                custom.style.display = 'block';
            }
        }
    });

    var api = document.createElement('div');
    api.title = '';
    api.style.display = 'none';
    api.innerHTML = '<span class="title">' + i18n['api'] + '</span><select name="capture_api" value="1"><option value="0">downloads API</option><option value="1">webRequest API</option></select>';
    api.addEventListener('change', event => folder.style.display = event.target.value === '1' ? 'none' : 'block');

    var folder = document.createElement('div');
    folder.title = '';
    folder.style.display = 'none';
    folder.innerHTML = '<span class="title">' + i18n['folder'] + '</span><select name="folder_mode" value="0"><option value="0">' + i18n['0'] + '</option><option value="1">' + i18n['1'] + '</option><option value="2">' + i18n['2'] + '</option></select>';
    folder.addEventListener('change', event => custom.style.display = event.target.value === '2' ? 'block' : 'none');

    var custom = document.createElement('div');
    custom.title = '';
    custom.style.display = 'none';
    custom.innerHTML = '<input name="folder_path" placeholder="' + (os === 'win' ? 'C:\\Downloads\\' : '/home/downloads/') + '">';
    folder.append(custom);

    iframe.querySelector('.float').style.right = '37px';
    iframe.querySelector('#option > div:nth-child(11)').append(safe);
    iframe.querySelector('#option > div:nth-child(12)').before(api, folder);
    
    api.querySelector('select').value = store['capture_api'];
    folder.querySelector('select').value = store['folder_mode'];
    custom.querySelector('input').value = store['folder_path'];
});
