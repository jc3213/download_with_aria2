document.querySelector('iframe').addEventListener('load', async event => {
    var store = await browser.storage.local.get(null);

    var safemode = document.createElement('button');
    safemode.innerText = 'Legacy Mode';
    safemode.addEventListener('click', event => legacy.style.display = confirm('Dangerous!') ? safemode.remove() ?? 'block' : 'none');

    var legacy = document.createElement('div');
    legacy.className = 'submenu';
    legacy.style.display = 'none';
    legacy.innerHTML = '<div><span class="title">Capture API</span><select name="capture_api"><option value="0">downloads API</option><option value="1">webRequest API</option></select></div>\
        <div><div><span class="title">Capture Save Folder</span><select name="folder_mode"><option value="0">Default</option><option value="1">Browser</option><option value="2">Folder</option></select><div><input name="folder_path" type="folder"></div></div></div>';
    legacy.addEventListener('change', event => (store[event.target.name] = event.target.value) && browser.storage.local.set(store));

    var manager = event.target.contentDocument.querySelector('#manager');
    manager.appendChild(safemode);
    manager.parentNode.append(legacy);
});