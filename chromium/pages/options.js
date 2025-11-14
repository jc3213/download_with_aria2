let aria2Storage = {};
let aria2Config = {};
let aria2Version;

let updated = {};
let undoes = [];
let undone = false;
let redoes = [];

let extension = document.body.classList;
let [menuPane, optionsPane, jsonrpcPane, template] = document.body.children;
let [saveBtn, undoBtn, redoBtn, tellVer, importBtn, exportBtn, jsonFile, confFile, exporter] = menuPane.children;
let tellUA = document.getElementById('useragent');
let optionsEntries = optionsPane.querySelectorAll('[name]');
let optionsMatches = optionsPane.querySelectorAll('.matches div[id]');
let jsonrpcEntries = jsonrpcPane.querySelectorAll('[name]');
let matchLET = template.children[0];

if (typeof browser !== 'undefined') {
    extension.add('firefox');
}

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.querySelectorAll('[i18n-tips]').forEach((node) => {
    node.title = chrome.i18n.getMessage(node.getAttribute('i18n-tips'));
});

const hotkeyMap = {
    's': saveBtn,
    'y': redoBtn,
    'z': undoBtn
};

document.addEventListener('keydown', (event) => {
    let key = hotkeyMap[event.key];
    if (event.ctrlKey && key) {
        event.preventDefault();
        key.click();
    }
});

function optionHistorySave(json) {
    let { id, new_value } = json;
    updated[id] = new_value;
    undoes.push(json);
    saveBtn.disabled = undoBtn.disabled = false;
    if (undone) {
        redoes = [];
        undone = false;
        redoBtn.disabled = true;
    }
}

const valueHandlers = {
    'string': (entry) => entry.value,
    'number': (entry) => entry.value | 0,
    'checkbox': (entry, name) => {
        if (entry.hasAttribute('data-css')) {
            extension.toggle(name);
        }
        return entry.checked;
    }
}

optionsPane.addEventListener('change', (event) => {
    let entry = event.target;
    let { name: id, type } = entry;
    if (!id) {
        return;
    }
    let handler = valueHandlers[type] ?? valueHandlers['string'];
    let new_value = handler(entry, id);
    optionHistorySave({ id, new_value, old_value: updated[id], type, entry });
});

jsonrpcPane.addEventListener('change', (event) => {
    let entry = event.target;
    let { name: id, value: new_value } = event.target;
    optionHistorySave({ id, new_value, old_value: updated[id], type: 'text', entry });
});

function menuEventSave() {
    saveBtn.disabled = true;
    extension.contains('jsonrpc')
        ? chrome.runtime.sendMessage({ action: 'jsonrpc_update', params: updated })
        : storageUpdate();
}

function menuEventUndo() {
    let undo = undoes.pop();
    redoes.push(undo);
    optionHistoryLoad('undo', 'old_value', undo);
    saveBtn.disabled = redoBtn.disabled = false;
    undone = true;
    if (undoes.length === 0) {
        undoBtn.disabled = true;
    }
}

function menuEventRedo() {
    let redo = redoes.pop();
    undoes.push(redo);
    optionHistoryLoad('redo', 'new_value', redo);
    saveBtn.disabled = undoBtn.disabled = false;
    if (redoes.length === 0) {
        redoBtn.disabled = true;
    }
}

const optionHandlers = {
    'string': ({ entry, value }) => entry.value = value,
    'checkbox': ({ entry, id, value }) => {
        if (entry.hasAttribute('data-css')) {
            extension.toggle(id);
        }
        entry.checked = value;
    },
    'matches': ({ add, remove }, action) => {
        if (action === 'undo') {
            add?.rule?.remove();
            remove?.list?.insertBefore(remove.rule, remove.list.children[remove.index]);
        } else {
            add?.list?.insertBefore(add.rule, add.list.children[add.index]);
            remove?.rule?.remove();
        }
    },
    'resort': ({ list, old_order, new_order }, action) => {
        action === 'undo' ? list.append(...old_order) : list.append(...new_order);
    }
};

function optionHistoryLoad(action, key, json) {
    let { id, type } = json;
    let handler = optionHandlers[type] ?? optionHandlers['string'];
    updated[id] = json.value = json[key];
    handler(json, action);
}

function exportHandler(name, type, body) {
    let time = new Date().toLocaleString('ja').replace(/[: /]/g, '_');
    let blob = new Blob(body);
    exporter.href = URL.createObjectURL(blob);
    exporter.download = name + time + type;
    exporter.click();
}

function menuEventExport() {
    extension.contains('jsonrpc')
        ? exportHandler('aria2_jsonrpc-', '.conf', Object.keys(aria2Config).map((key) => key + '=' + aria2Config[key] + '\n' ))
        : exportHandler('downwitharia2-', '.json', [ JSON.stringify(aria2Storage, null, 4) ]);
}

function menuEventImport() {
    extension.contains('jsonrpc') ? confFile.click() : jsonFile.click();
}

const menuEventMap = {
    'common_save': menuEventSave,
    'option_undo': menuEventUndo,
    'option_redo': menuEventRedo,
    'option_export': menuEventExport,
    'option_import': menuEventImport,
};

menuPane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n');
    menuEventMap[menu]?.();
});

function importJson(file) {
    updated = JSON.parse(file);
    storageUpdate();
    storageDispatch();
}

function importConf(file) {
    let json = {};
    file.split('\n').forEach((line) => {
        if (!line || line[0] === '#') {
            return;
        }
        let [key, value] = line.split('=');
        if (key && value !== undefined) {
            json[key] = value.split('#')[0].trim();
        }
    });
    optionsDispatch(json);
    chrome.runtime.sendMessage({ action: 'jsonrpc_update', params: updated });
}

menuPane.addEventListener('change', (event) => {
    let file = event.target.files[0];
    let reader = new FileReader();
    reader.onload = (event) => {
        optionHistoryFlush();
        file.name.endsWith('.json') ? importJson(reader.result) : importConf(reader.result);
        event.target.value = '';
    };
    reader.readAsText(file);
});

function optionsDispatch(json) {
    jsonrpcEntries.forEach((entry) => {
        let { name } = entry;
        entry.value = aria2Config[name] = json[name] ?? '';
    });
    updated = { ...aria2Config };
}

function optionHistoryFlush() {
    undoes = [];
    redoes = [];
    saveBtn.disabled = undoBtn.disabled = redoBtn.disabled = true;
}

document.getElementById('goto-jsonrpc').addEventListener('click', (event) => {
    chrome.runtime.sendMessage({ action: 'system_runtime' }, ({ options, version }) => {
        if (version) {
            optionHistoryFlush();
            optionsDispatch(options);
            tellVer.textContent = tellUA.textContent = version.version;
            extension.add('jsonrpc');
        }
    });
});

document.getElementById('goto-options').addEventListener('click', (event) => {
    optionHistoryFlush();
    storageDispatch();
    extension.remove('jsonrpc');
});

function matchEventAddNew(id, list, entry) {
    let value = entry.value.match(/^(?:https?:\/\/|\/\/)?(\*|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})(?=\/|$)/)?.[1];
    let old_value = updated[id];
    entry.value = '';
    if (value && !old_value.includes(value)) {
        let new_value = [...old_value, value];
        let rule = printMatchPattern(list, id, value);
        list.scrollTop = list.scrollHeight;
        optionHistorySave({ id, new_value, old_value, type: 'matches', add: { list, index: old_value.length, rule } });
    }
}

function matchEventResort(id, list) {
    let old_value = updated[id];
    let new_value = [...old_value].sort();
    let old_order = [...list.children];
    let new_order = [...old_order].sort((a, b) => a.textContent.localeCompare(b.textContent));
    list.append(...new_order);
    optionHistorySave({ id, new_value, old_value, type: 'resort', list, new_order, old_order });
}

function matchEventRemove(id, list, _, event) {
    let rule = event.target.parentNode;
    let value = rule.title;
    let old_value = updated[id];
    let index = old_value.indexOf(value);
    let new_value = old_value.filter((val) => val !== value);
    rule.remove();
    optionHistorySave({ id, new_value, old_value, type: 'matches', remove: { list, index, rule } });
}

const listEventMap = {
    'tips_match_addnew': matchEventAddNew,
    'tips_match_resort': matchEventResort,
    'tips_match_remove': matchEventRemove,
};

optionsMatches.forEach((match) => {
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
});

function createMatchPattern(value) {
    let rule = matchLET.cloneNode(true);
    rule.title = rule.children[0].textContent = value;
    return rule;
}

function printMatchPattern(list, id, value) {
    let rule = list[value] ??= createMatchPattern(value);
    list.appendChild(rule);
    return rule;
}

function storageDispatch() {
    updated = { ...aria2Storage };
    tellVer.textContent = aria2Version;
    optionsEntries.forEach((entry) => {
        let { name, type } = entry;
        let value = updated[name];
        if (type === 'checkbox') {
            if (entry.hasAttribute('data-css')) {
                value ? extension.add(name) : extension.remove(name);
            }
            entry.checked = value;
        } else {
            entry.value = value;
        }
    });
    optionsMatches.forEach(({ id, list }) => {
        list.innerHTML = '';
        updated[id].forEach((value) => printMatchPattern(list, id, value));
    });
}

function storageUpdate() {
    aria2Storage = { ...updated };
    chrome.runtime.sendMessage({ action: 'storage_update', params: updated });
}

chrome.runtime.sendMessage({ action: 'system_runtime'}, ({ storage, manifest }) => {
    aria2Storage = storage;
    aria2Version = manifest.version;
    storageDispatch();
});
