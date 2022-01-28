document.querySelector('iframe').addEventListener('load', async event => {
    var store = await browser.storage.local.get(null);
    var danger = false;

    var iframe = event.target.contentDocument;
    var filters = iframe.querySelector('#option > div:nth-child(3)');
    var capture = iframe.querySelector('select[name="capture_mode"]');
    capture.addEventListener('change', event => {
        safe.style.display = ['1', '2'].includes(capture.value) ? 'inline-block' : 'none';
        danger && (menu.style.display = ['1', '2'].includes(capture.value) ? 'block' : 'none');
    });

    var safe = document.createElement('button');
    safe.innerText = 'Safe Mode';
    safe.style.display = ['1', '2'].includes(capture.value) ? 'inline-block' : 'none';
    safe.addEventListener('click', event =>  {
        if (confirm('Dangerous!')) {
            danger = true;
            safe.remove();
            iframe.querySelector('body > div:nth-child(1) > div:nth-child(1) > button:nth-child(3)').click();
            menu.style.display = 'block';
        }
    });
    
    var api = document.createElement('div');
    api.innerHTML = '<span class="title">Capture API</span> <select name="capture_api" value="' + (store['capture_api'] ?? '1') + '"><option value="0">downloads API</option><option value="1">webRequest API</option></select>';

    var mode = document.createElement('div');
    mode.innerHTML = '<span class="title">Capture Save Folder</span> <select name="folder_mode" value="' + (store['folder_mode'] ?? '0') + '"><option value="0">Default</option><option value="1">Browser</option><option value="2">Custom Folder</option></select>';
    mode.addEventListener('change', event => folder.style.display = mode.value === '2' ? 'block': 'none');

    var folder = document.createElement('div');
    folder.style.display = mode.value === '2' ? 'block': 'none';
    folder.innerHTML = '<input name="folder_path" value="' + (store['folder_path'] ?? '') + '"></div>';

    var menu = document.createElement('div');
    menu.className = 'submenu';
    menu.style.display = 'none';
    menu.addEventListener('change', event => (store[event.target.name] = event.target.value) && browser.storage.local.set(store));
    menu.append(api, mode, folder);

    iframe.querySelector('#option > div:nth-child(3) > div:nth-child(1)').appendChild(safe);
    filters.insertBefore(menu, filters.childNodes[2]);
});
