let aria2Storage = {};
let aria2Config = {};
let aria2Version;

let changes = {};
let undoes = [];
let redoes = [];

let extension = document.body.classList;
let [menuPane, storagePane, jsonrpcPane, template] = document.body.children;
let [saveBtn, undoBtn, redoBtn, tellVer, importBtn, exportBtn, fileEntry, exporter] = menuPane.children;
let tellUA = document.getElementById('useragent');
let storageEntries = storagePane.querySelectorAll('[name]');
let storageMatches = storagePane.querySelectorAll('.matches div[id]');
let jsonrpcEntries = jsonrpcPane.querySelectorAll('[name]');
let matchLET = template.children[0];

for (let i18n of document.querySelectorAll('[i18n]')) {
    i18n.textContent = chrome.i18n.getMessage(i18n.getAttribute('i18n'));
}

for (let i18n of document.querySelectorAll('[i18n-tips]')) {
    i18n.title = chrome.i18n.getMessage(i18n.getAttribute('i18n-tips'));
}

const hotkeyMap = {
    'KeyS': saveBtn,
    'KeyY': redoBtn,
    'KeyZ': undoBtn
};

document.addEventListener('keydown', (event) => {
    let key = hotkeyMap[event.code];
    if (event.ctrlKey && key) {
        event.preventDefault();
        key.click();
    }
});

function changeHistorySave(change) {
    let { id, new_value } = change;
    changes[id] = new_value;
    undoes.push(change);
    saveBtn.disabled = undoBtn.disabled = false;
    redoes = [];
    redoBtn.disabled = true;
}

storagePane.addEventListener('change', (event) => {
    let entry = event.target;
    let { name: id, type, value, checked } = entry;
    if (!id) {
        return;
    }
    if (type === 'number') {
        value = value | 0;
    } else if (type === 'checkbox') {
        value = checked;
        if (entry.hasAttribute('data-css')) {
            extension.toggle(id);
        }
    }
    changeHistorySave({ id, new_value: value, old_value: changes[id], type, entry });
});

jsonrpcPane.addEventListener('change', (event) => {
    let entry = event.target;
    let { name: id, value: new_value } = event.target;
    changeHistorySave({ id, new_value, old_value: changes[id], type: 'text', entry });
});

function menuEventSave() {
    saveBtn.disabled = true;
    if (extension.contains('jsonrpc')) {
        chrome.runtime.sendMessage({ action: 'jsonrpc_update', params: changes });
    } else {
        storageUpdate();
    }
}

function changeHistoryLoad(loadList, saveList, loadButton, saveButton, key, todo) {
    let change = loadList.pop();
    let { id, type, [key]: value, entry, add, remove, sort } = change;
    if (type === 'checkbox') {
        if (entry.hasAttribute('data-css')) {
            extension.toggle(id);
        }
        entry.checked = value;
    } else if (type === 'rules') {
        if (todo === 'undo') {
            add?.rule?.remove();
            remove?.list?.insertBefore(remove.rule, remove.list.children[remove.index]);
        } else {
            add?.list?.insertBefore(add.rule, add.list.children[add.index]);
            remove?.rule?.remove();
        }
    } else if (type === 'resort') {
        let order = todo === 'undo' ? sort.old_order : sort.new_order;
        sort.list.append(...order);
    } else {
        entry.value = value;
    }
    changes[id] = value;
    saveList.push(change);
    loadButton.disabled = loadList.length === 0;
    saveButton.disabled = saveBtn.disabled = false;
}

function menuEventExport() {
    let name;
    let body;
    let time = new Date().toLocaleString('ja').replace(/[/ :]/g, '_');
    if (extension.contains('jsonrpc')) {
        name = 'aria2_jsonrpc-' + time + '.conf';
        body = [];
        for (let key of Object.keys(aria2Config)) {
            body.push(key + '=' + aria2Config[key] + '\n');
        }
    } else {
        name = 'downwitharia2-' + time + '.json';
        body = [JSON.stringify(aria2Storage, null, 4)];
    }
    let blob = new Blob(body);
    exporter.href = URL.createObjectURL(blob);
    exporter.download = name;
    exporter.click();
}

function menuEventImport() {
    fileEntry.accept = extension.contains('jsonrpc') ? '.conf' : '.json';
    fileEntry.click();
}

const menuEventMap = {
    'option_save': menuEventSave,
    'option_undo': () => changeHistoryLoad(undoes, redoes, undoBtn, redoBtn, 'old_value', 'undo'),
    'option_redo': () => changeHistoryLoad(redoes, undoes, redoBtn, undoBtn, 'new_value', 'redo'),
    'option_export': menuEventExport,
    'option_import': menuEventImport
};

menuPane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n');
    menuEventMap[menu]?.();
});

function importJson(file) {
    changes = JSON.parse(file);
    storageUpdate();
    storageDispatch();
}

function importConf(file) {
    let options = {};
    for (let line of file.split('\n')) {
        if (!line || line[0] === '#') {
            continue;
        }
        let [key, value] = line.split('=');
        if (key in aria2Config && value) {
            options[key] = value.split('#')[0].trim();
        }
    }
    optionsDispatch(options);
    chrome.runtime.sendMessage({ action: 'jsonrpc_update', params: changes });
}

fileEntry.addEventListener('change', (event) => {
    let [file] = fileEntry.files;
    let reader = new FileReader();
    reader.onload = () => {
        changeHistoryFlush();
        fileEntry.accept === '.json' ? importJson(reader.result) : importConf(reader.result);
        fileEntry.value = '';
    };
    reader.readAsText(file);
});

function optionsDispatch(options) {
    for (let entry of jsonrpcEntries) {
        let { name } = entry;
        entry.value = aria2Config[name] = options[name] ?? '';
    }
    changes = { ...aria2Config };
}

function changeHistoryFlush() {
    undoes = [];
    redoes = [];
    saveBtn.disabled = undoBtn.disabled = redoBtn.disabled = true;
}

document.getElementById('goto-jsonrpc').addEventListener('click', (event) => {
    chrome.runtime.sendMessage({ action: 'system_runtime' }, ({ options, version }) => {
        if (version) {
            tellVer.textContent = tellUA.textContent = version.version;
            optionsDispatch(options);
            changeHistoryFlush();
            extension.add('jsonrpc');
        }
    });
});

document.getElementById('goto-options').addEventListener('click', (event) => {
    storageDispatch();
    changeHistoryFlush();
    extension.remove('jsonrpc');
});

function matchEventAddNew(id, list, entry) {
    let value = entry.value.match(/^(?:https?:\/\/|\/\/)?((?:[a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]{2,})(?=\/|$)/)?.[1];
    let old_value = changes[id];
    if (value && !old_value.includes(value)) {
        let new_value = old_value.slice();
        let rule = printMatchPattern(list, id, value);
        new_value.push(value);
        list.scrollTop = list.scrollHeight;
        changeHistorySave({ id, new_value, old_value, type: 'rules', add: { list, index: old_value.length, rule } });
        entry.value = '';
    }
}

function matchEventResort(id, list) {
    let old_value = changes[id];
    let new_value = old_value.slice().sort();
    let old_order = [...list.children];
    let new_order = old_order.slice().sort((a, b) => a.textContent.localeCompare(b.textContent));
    list.append(...new_order);
    changeHistorySave({ id, new_value, old_value, type: 'resort', sort: { list, new_order, old_order } });
}

function matchEventRemove(id, list, _, event) {
    let rule = event.target.parentNode;
    let value = rule.title;
    let old_value = changes[id];
    let index = old_value.indexOf(value);
    let new_value = old_value.slice();
    new_value.splice(index, 1);
    rule.remove();
    changeHistorySave({ id, new_value, old_value, type: 'rules', remove: { list, index, rule } });
}

const listEventMap = {
    'tips_match_addnew': matchEventAddNew,
    'tips_match_resort': matchEventResort,
    'tips_match_remove': matchEventRemove,
};

for (let match of storageMatches) {
    let { id } = match;
    let [menu, list] = match.children;
    let entry = menu.children[1];
    match.list = list;
    match.addEventListener('click', (event) => {
        let menu = event.target.getAttribute('i18n-tips');
        listEventMap[menu]?.(id, list, entry, event);
    });
    entry.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            matchEventAddNew(id, list, entry);
        }
    });
}

function printMatchPattern(list, id, value) {
    let rule = matchLET.cloneNode(true);
    rule.title = rule.children[0].textContent = value;
    list.appendChild(rule);
    return rule;
}

function storageDispatch() {
    changes = { ...aria2Storage };
    tellVer.textContent = aria2Version;
    for (let entry of storageEntries) {
        let { name, type } = entry;
        let value = changes[name];
        if (type === 'checkbox') {
            if (entry.hasAttribute('data-css')) {
                value ? extension.add(name) : extension.remove(name);
            }
            entry.checked = value;
        } else {
            entry.value = value;
        }
    }
    for (let { id, list } of storageMatches) {
        list.innerHTML = '';
        for (let value of changes[id]) {
            printMatchPattern(list, id, value);
        }
    }
}

function storageUpdate() {
    aria2Storage = { ...changes };
    chrome.runtime.sendMessage({ action: 'storage_update', params: changes });
}

chrome.runtime.sendMessage({ action: 'system_runtime'}, ({ storage, manifest }) => {
    aria2Storage = storage;
    aria2Version = manifest.version;
    if (manifest.browser_specific_settings) {
        extension.add('firefox');
    }
    storageDispatch();
});
