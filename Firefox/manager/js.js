document.querySelector('iframe').addEventListener('load', async event => {
    var store = await browser.storage.local.get(null);

    var mode = document.createElement('button');
    mode.innerText = 'Safe Mode';
    mode.addEventListener('click', event => danger.style.display = confirm('Dangerous!') ? mode.remove() ?? 'block' : 'none');

    var danger = document.createElement('div');
    danger.className = 'submenu';
    danger.style.display = 'none';
    danger.innerHTML = '<div><span class="title">Capture API</span> <select name="capture_api" value="1"><option value="0">downloads API</option><option value="1">webRequest API</option></select></div>\
        <div><div><span class="title">Capture Save Folder</span> <select name="folder_mode" value="0"><option value="0">Default</option><option value="1">Browser</option><option value="2">Custom Folder</option></select><div><input name="folder_path"></div></div></div>';
    danger.addEventListener('change', event => (store[event.target.name] = event.target.value) && browser.storage.local.set(store));
    danger.querySelectorAll('[name]').forEach(field => field.value = store[field.name] ?? field.value);

    var manager = event.target.contentDocument.querySelector('#manager');
    manager.appendChild(mode);
    manager.parentNode.append(danger);
});
