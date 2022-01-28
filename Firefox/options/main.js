document.querySelector('iframe').addEventListener('load', async event => {
    var store = await browser.storage.local.get(null);
    var danger = false;
    var i18n = {
        'en': {safe: 'Safe Mode', danger: 'Dangerous!', api: 'Capture API', folder: 'Capture Download Folder', '0': 'Default', '1': 'Browser', '2': 'Custom Folder'},
        'zh': {safe: '安全模式', danger: '危险！', api: '选择API', folder: '抓取下载文件夹', '0': '默认', '1': '浏览器', '2': '自定义'}
    };
    var accept = await browser.i18n.getAcceptLanguages().then(languages => languages.filter(lang => i18n[lang]));
    i18n = i18n[accept[0]] ?? i18n['en'];

    var iframe = event.target.contentDocument;
    var filters = iframe.querySelector('#option > div:nth-child(3)');
    var capture = iframe.querySelector('select[name="capture_mode"]');
    capture.addEventListener('change', event => {
        safe.style.display = ['1', '2'].includes(capture.value) ? 'inline-block' : 'none';
        danger && (menu.style.display = ['1', '2'].includes(capture.value) ? 'block' : 'none');
    });

    var safe = document.createElement('button');
    safe.innerText = i18n['safe'];
    safe.style.display = ['1', '2'].includes(capture.value) ? 'inline-block' : 'none';
    safe.addEventListener('click', event =>  {
        if (confirm(i18n['danger'])) {
            danger = true;
            safe.remove();
            iframe.querySelector('body > div:nth-child(1) > div:nth-child(1) > button:nth-child(3)').click();
            menu.style.display = 'block';
        }
    });

    var api = document.createElement('div');
    api.innerHTML = '<span class="title">' + i18n['api'] + '</span> <select name="capture_api" value="1"><option value="0">downloads API</option><option value="1">webRequest API</option></select>';

    var folder = document.createElement('div');
    folder.innerHTML = '<span class="title">' + i18n['folder'] + '</span> <select name="folder_mode" value="0"><option value="0">' + i18n['0'] + '</option><option value="1">' + i18n['1'] + '</option><option value="2">' + i18n['2'] + '</option></select>';
    folder.addEventListener('change', event => custom.style.display = event.target.value === '2' ? 'block': 'none');

    var custom = document.createElement('div');
    custom.style.display = store['folder_mode'] === '2' ? 'block': 'none';
    custom.innerHTML = '<input name="folder_path">';
    folder.append(custom);


    var menu = document.createElement('div');
    menu.className = 'submenu';
    menu.style.display = 'none';
    menu.append(api, folder);
    menu.querySelectorAll('[name]').forEach(field => field.value = store[field.name] ?? field.value);
    menu.addEventListener('change', event => (store[event.target.name] = event.target.value) && browser.storage.local.set(console.log(store) ?? store));

    iframe.querySelector('#option > div:nth-child(3) > div:nth-child(1)').appendChild(safe);
    filters.insertBefore(menu, filters.childNodes[2]);
});
