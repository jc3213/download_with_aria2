let aria2Storage = {};
let aria2Config = {};
let aria2Version;

let toggle = false;
let changes = {};
let undoes = [];
let redoes = [];

let extension = document.body.classList;
let [menuPane, storagePane, jsonrpcPane, template] = document.body.children;
let [saveBtn, undoBtn, redoBtn, tellVer, importBtn, exportBtn, fileEntry, exporter] = menuPane.children;
let tellUA = document.getElementById('useragent');
let storageEntries = storagePane.querySelectorAll('[name]');
let jsonrpcEntries = jsonrpcPane.querySelectorAll('[name]');
let matchLET = template.children[0];

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

function storageUpdate() {
    aria2Storage = { ...changes };
    chrome.runtime.sendMessage({ action: 'options_storage', params: changes });
}

function menuEventSave() {
    saveBtn.disabled = true;
    if (toggle) {
        chrome.runtime.sendMessage({ action: 'options_jsonrpc', params: changes });
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
    if (toggle) {
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
    fileEntry.accept = toggle ? '.conf' : '.json';
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
    chrome.runtime.sendMessage({ action: 'options_jsonrpc', params: changes });
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
    chrome.runtime.sendMessage({ action: 'options_runtime' }, ({ options, version }) => {
        if (!version) {
            return;
        }
        tellVer.textContent = tellUA.textContent = version.version;
        optionsDispatch(options);
        changeHistoryFlush();
        extension.add('jsonrpc');
        toggle = true;
    });
});

document.getElementById('goto-options').addEventListener('click', (event) => {
    storageDispatch();
    changeHistoryFlush();
    extension.remove('jsonrpc');
    toggle = false;
});

function matchEventAdd(id) {
    let { entry } = matchLists.get(id);
    let host = entry.value.match(/^(?:https?:\/\/|\/\/)?(\*|(?:[a-zA-Z0-9-]+\.)*[a-zA-Z0-9]+)(?=\/|$)/)?.[1];
    entry.value = '';
    if (host) {
        matchAddToList({ id, host });
    }
}

function matchEventResort(id) {
    let { list } = matchLists.get(id);
    let old_value = changes[id];
    let new_value = old_value.slice().sort();
    let old_order = [...list.children];
    let new_order = old_order.slice().sort((a, b) => a.textContent.localeCompare(b.textContent));
    list.append(...new_order);
    changeHistorySave({ id, new_value, old_value, type: 'resort', sort: { list, new_order, old_order } });
}

function matchEventRemove(id, event) {
    let host = event.target.parentNode.title;
    matchRemoveFromList({ id, host });
}

const matchLists = new Map();
const matchEvents = {
    'tips_match_add': matchEventAdd,
    'tips_match_resort': matchEventResort,
    'tips_match_remove': matchEventRemove,
};

for (let match of storagePane.querySelectorAll('div.flexmenu')) {
    let { id } = match;
    let [h4, entry, b1, b2, list] = match.children;
    matchLists.set(id, { list, entry });
    match.addEventListener('click', (event) => {
        let menu = event.target.getAttribute('i18n-tips');
        matchEvents[menu]?.(id, event);
    });
    entry.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            matchEventAdd(id);
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
    for (let [id,  { list }] of matchLists) {
        list.innerHTML = '';
        for (let value of changes[id]) {
            printMatchPattern(list, id, value);
        }
    }
}

function matchAddToList(add) {
    if (toggle) {
        return;
    }
    let { id, host } = add;
    let old_value = changes[id];
    if (old_value.includes(host)) {
        return;
    }
    let { list } = matchLists.get(id);
    let new_value = old_value.slice();
    let rule = printMatchPattern(list, id, host);
    new_value.push(host);
    list.scrollTop = list.scrollHeight;
    changeHistorySave({ id, new_value, old_value, type: 'rules', add: { list, index: old_value.length, rule } });
}

function matchRemoveFromList(remove) {
    if (toggle) {
        return;
    }
    let { id, host } = remove;
    let { list } = matchLists.get(id);
    let old_value = changes[id];
    let index = old_value.indexOf(host);
    let new_value = old_value.slice();
    let rule = list.querySelector('[title="' + host + '"]');
    new_value.splice(index, 1);
    rule.remove();
    changeHistorySave({ id, new_value, old_value, type: 'rules', remove: { list, index, rule } });
}

const messageDispatch = {
    'match_add': matchAddToList,
    'match_remove': matchRemoveFromList
};

chrome.runtime.onMessage.addListener(({ options, params }) => {
    messageDispatch[options]?.(params);
});

chrome.runtime.sendMessage({ action: 'options_runtime'}, ({ storage, manifest }) => {
    aria2Storage = storage;
    aria2Version = manifest.version;
    if (manifest.browser_specific_settings) {
        extension.add('firefox');
    }
    storageDispatch();
});
