let aria2Storage = {};
let aria2Config = {};
let aria2Version;

let updated = {};
let undoes = [];
let undone = false;
let redoes = [];

let extension = document.body.classList;
let [menuPane, optionsPane, jsonrpcPane, template] = document.body.children;
let [saveBtn, undoBtn, redoBtn, tellVer, exportBtn, importBtn, jsonFile, confFile, exporter] = menuPane.children;
let tellUA = document.getElementById('useragent');
let optionsEntries = optionsPane.querySelectorAll('[name]');
let optionsMatches = optionsPane.querySelectorAll('.matches div[id]');
let jsonrpcEntries = jsonrpcPane.querySelectorAll('[name]');
let matchLET = template.children[0];

if (typeof browser !== 'undefined') {
    firefoxExclusive();
}

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.querySelectorAll('[i18n-tips]').forEach((node) => {
    node.title = chrome.i18n.getMessage(node.getAttribute('i18n-tips'));
});

function shortcutHandler(event, ctrlKey, button) {
    if (ctrlKey) {
        event.preventDefault();
        button.click();
    }
}

document.addEventListener('keydown', (event) => {
    let {key, ctrlKey} = event;
    switch (key) {
        case 's':
            shortcutHandler(event, ctrlKey, saveBtn);
            break;
        case 'y':
            shortcutHandler(event, ctrlKey, redoBtn);
            break;
        case 'z':
            shortcutHandler(event, ctrlKey, undoBtn);
            break;
    };
});

function optionsHistoryAdd(id, new_value, undo) {
    updated[id] = new_value;
    undoes.push({id, new_value, ...undo});
    saveBtn.disabled = undoBtn.disabled = false;
    if (undone) {
        redoes = [];
        undone = false;
        redoBtn.disabled = true;
    }
}

optionsPane.addEventListener('change', (event) => {
    let entry = event.target;
    let {name, value, type, checked} = entry;
    if (!name) {
        return;
    }
    switch (type) {
        case 'number': 
            value = value | 0;
            break;
        case 'checkbox':
            value = checked;
            if (entry.dataset.key) {
                extension.toggle(name);
            }
            break;
    }
    optionsHistoryAdd(name, value, {old_value: updated[name], type, entry});
});

jsonrpcPane.addEventListener('change', (event) => {
    let entry = event.target;
    let {name, value} = event.target;
    optionsHistoryAdd(name, value, {old_value: updated[name], type: 'text', entry});
});

function menuEventSave() {
    saveBtn.disabled = true;
    extension.contains('jsonrpc') ? chrome.runtime.sendMessage({action: 'jsonrpc_update', params: updated}) : aria2StorageUpdate();
}

function menuEventUndo() {
    let undo = undoes.pop();
    redoes.push(undo);
    optionsHistoryLoad('undo', undo.old_value, undo);
    saveBtn.disabled = redoBtn.disabled = false;
    undone = true;
    if (undoes.length === 0) {
        undoBtn.disabled = true;
    }
}

function menuEventRedo() {
    let redo = redoes.pop();
    undoes.push(redo);
    optionsHistoryLoad('redo', redo.new_value, redo);
    saveBtn.disabled = undoBtn.disabled = false;
    if (redoes.length === 0) {
        redoBtn.disabled = true;
    }
}

function optionsHistoryLoad(action, value, {id, type, entry, add, remove, resort}) {
    updated[id] = value;
    switch (type) {
        case 'text':
        case 'number':
            entry.value = value;
            break;
        case 'checkbox':
            if (entry.dataset.key) {
                extension.toggle(id);
            }
            entry.checked = value;
            break;
        case 'matches':
            self[action + 'MatchPattern'](add, remove);
            break;
        case 'resort':
            self[action + 'Resort'](resort);
            break;
    };
}

function undoResort({list, old_order}) {
    list.append(...old_order);
}

function redoResort({list, new_order}) {
    list.append(...new_order);
}

function undoMatchPattern(add, remove) {
    add?.forEach(({rule}) => rule.remove());
    remove?.forEach(({list, index, rule}) => list.insertBefore(rule, list.children[index]));
}

function redoMatchPattern(add, remove) {
    add?.forEach(({list, index, rule}) => list.insertBefore(rule, list.children[index]));
    remove?.forEach(({rule}) => rule.remove());
}

function menuEventExport() {
    let name;
    let body;
    let time = new Date().toLocaleString('ja').replace(/[\/\s:]/g, '_');
    if (extension.contains('jsonrpc')) {
        name = 'aria2_jsonrpc-' + time + '.conf';
        body = Object.keys(aria2Config).map((key) => (key + '=' + aria2Config[key] + '\n'));
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
    extension.contains('jsonrpc') ? confFile.click() : jsonFile.click();
}

menuPane.addEventListener('click', (event) => {
    let button = event.target.getAttribute('i18n');
    if (!button) {
        return;
    }
    switch (button) {
        case 'common_save':
            menuEventSave();
            break;
        case 'option_undo':
            menuEventUndo();
            break;
        case 'option_redo':
            menuEventRedo();
            break;
        case 'option_export':
            menuEventExport();
            break;
        case 'option_import':
            menuEventImport();
            break;
    };
});

jsonFile.addEventListener('change', async (event) => {
    optionsHistoryFlush();
    let file = await promiseFileReader(event.target.files[0]);
    updated = JSON.parse(file);
    aria2StorageUpdate();
    aria2StorageSetup();
    event.target.value = '';
});

confFile.addEventListener('change', async (event) => {
    optionsHistoryFlush();
    let file = await promiseFileReader(event.target.files[0]);
    let params = {};
    file.split('\n').forEach((line) => {
        if (line[0] !== '#') {
            let [key, value] = line.split('=');
            params[key] = value;
        }
    });
    chrome.runtime.sendMessage({action: 'jsonrpc_update', params});
    aria2ConfigSetup(params);
    event.target.value = '';
});

function promiseFileReader(file) {
    return new Promise((resolve) => {
        let reader = new FileReader();
        reader.onload = (event) => resolve(reader.result);
        reader.readAsText(file);
    });
}

function aria2ConfigSetup(json) {
    jsonrpcEntries.forEach((entry) => {
        entry.value = aria2Config[entry.name] = json[entry.name] ?? '';
    });
    updated = {...aria2Config};
}

function optionsHistoryFlush() {
    undoes = [];
    redoes = [];
    saveBtn.disabled = undoBtn.disabled = redoBtn.disabled = true;
}

document.getElementById('goto-jsonrpc').addEventListener('click', (event) => {
    chrome.runtime.sendMessage({action: 'system_runtime'}, ({options, version}) => {
        if (options && version) {
            optionsHistoryFlush();
            aria2ConfigSetup(options);
            tellVer.textContent = tellUA.textContent = version;
            extension.add('jsonrpc');
        }
    });
});

document.getElementById('goto-options').addEventListener('click', (event) => {
    optionsHistoryFlush();
    aria2StorageSetup();
    extension.remove('jsonrpc');
});

function matchEventAddNew(id, list, entry) {
    let old_value = updated[id];
    let new_value = [...old_value];
    let add = [];
    entry.value.match(/[^\s;]+/g)?.forEach((value) => {
        if (value && !new_value.includes(value)) {
            let rule = createMatchPattern(list, id, value);
            add.push({list, index: new_value.length, rule});
            new_value.push(value);
        }
    });
    entry.value = '';
    list.scrollTop = list.scrollHeight;
    optionsHistoryAdd(id, new_value, {old_value, type: 'matches', add});
}

function matchEventResort(id, list) {
    let old_value = updated[id];
    let new_value = [...old_value].sort();
    let old_order = [...list.children];
    let new_order = [...old_order].sort((a, b) => a.textContent.localeCompare(b.textContent));
    list.append(...new_order);
    optionsHistoryAdd(id, new_value, {old_value, type: 'resort', resort: {list, new_order, old_order}});
}

function matchEventRemove(id, list, rule) {
    let value = rule.title;
    let old_value = updated[id];
    let new_value = [...old_value];
    let index = old_value.indexOf(value);
    new_value.splice(index, 1);
    rule.remove();
    optionsHistoryAdd(id, new_value, {old_value, type: 'matches', remove: [{list, index, rule}]});
}

optionsMatches.forEach((match) => {
    let id = match.id;
    let [menu, list] = match.children;
    let entry = menu.children[1];
    match.list = list;
    match.addEventListener('click', (event) => {
        let button = event.target.getAttribute('i18n-tips');
        if (!button) {
            return;
        }
        switch (button) {
            case 'tips_match_addnew':
                matchEventAddNew(id, list, entry);
                break;
            case 'tips_match_resort':
                matchEventResort(id, list);
                break;
            case 'tips_match_remove':
                matchEventRemove(id, list, event.target.parentNode);
                break;
        };
    });
    entry.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            matchEventAddNew(id, list, entry, event);
        }
    });
});

function createMatchPattern(list, id, value) {
    let rule = matchLET.cloneNode(true);
    rule.title = rule.children[0].textContent = value;
    list.appendChild(rule);
    return rule;
}

function aria2StorageSetup() {
    updated = {...aria2Storage};
    tellVer.textContent = aria2Version;
    optionsEntries.forEach((entry) => {
        let {name, type, value, checked} = entry;
        if (type === 'checkbox') {
            if (entry.dataset.key) {
                updated[name] ? extension.add(name) : extension.remove(name);
            }
            entry.checked = updated[name];
        } else {
            entry.value = updated[name];
        }
    });
    optionsMatches.forEach(({id, list}) => {
        list.innerHTML = '';
        updated[id].forEach((value) => createMatchPattern(list, id, value));
    });
}

function aria2StorageUpdate() {
    aria2Storage = {...updated};
    chrome.runtime.sendMessage({action: 'storage_update', params: updated});
}

chrome.runtime.sendMessage({action: 'system_runtime'}, ({storage, manifest}) => {
    aria2Storage = storage;
    aria2Version = manifest.version;
    aria2StorageSetup();
});

function firefoxExclusive() {
    extension.add('firefox');
    let [folderff, captureen, captureff] = optionsPane.querySelectorAll('#folder_firefox, #capture_enabled, #capture_webrequest');
    captureen.addEventListener('change', (event) => {
        if (!captureen.checked) {
            folderff.checked = updated['folder_firefox'] = false;
        }
    });
    captureff.addEventListener('change', (event) => {
        if (captureff.checked) {
            folderff.checked = updated['folder_firefox'] = false;
        }
    });
}
