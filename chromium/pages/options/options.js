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

const shortcutMap = {
    's': saveBtn,
    'y': redoBtn,
    'z': undoBtn
};

document.addEventListener('keydown', (event) => {
    let key = shortcutMap[event.key];
    if (key && event.ctrlKey) {
        event.preventDefault();
        key.click();
    }
});

function optionHistoryApply(json) {
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
    if (!name) {
        return;
    }
    let handler = valueHandlers[type] ?? valueHandlers['string'];
    let new_value = handler(entry, name);
    optionHistoryApply({ id, new_value, old_value: updated[id], type, entry });
});

jsonrpcPane.addEventListener('change', (event) => {
    let entry = event.target;
    let { name: id, value: new_value } = event.target;
    optionHistoryApply({ id, new_value, old_value: updated[id], type: 'text', entry });
});

function menuEventSave() {
    saveBtn.disabled = true;
    extension.contains('jsonrpc')
        ? chrome.runtime.sendMessage({ action: 'options_jsonrpc', params: updated })
        : aria2StorageUpdate();
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

function optionHistoryLoad(action, key, props) {
    let { id, type } = props;
    let handler = optionHandlers[type] ?? optionHandlers['string'];
    updated[id] = props.value = props[key];
    handler(props, action);
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

function optionHistoryFlush() {
    undoes = [];
    redoes = [];
    saveBtn.disabled = undoBtn.disabled = redoBtn.disabled = true;
}

function promiseFileReader(file) {
    return new Promise((resolve) => {
        let reader = new FileReader();
        reader.onload = (event) => resolve(reader.result);
        reader.readAsText(file);
    });
}

function importFileJson(file) {
    updated = JSON.parse(file);
    aria2StorageUpdate();
    aria2StorageSetup();
}

function aria2ConfigSetup(json) {
    jsonrpcEntries.forEach((entry) => {
        let { name } = entry;
        entry.value = aria2Config[name] = json[name] ?? '';
    });
    updated = {...aria2Config};
}

function importFileConf(file) {
    let params = {};
    file.split('\n').forEach((line) => {
        if (line[0] !== '#') {
            let [key, value] = line.split('=');
            params[key] = value;
        }
    });
    chrome.runtime.sendMessage({ action: 'options_jsonrpc', params });
    aria2ConfigSetup(params);
}

menuPane.addEventListener('change', async (event) => {
    let file = await promiseFileReader(event.target.files[0]);
    event.target.value = '';
    optionHistoryFlush();
    extension.contains('jsonrpc') ? importFileConf(file) : importFileJson(file);
});

document.getElementById('goto-jsonrpc').addEventListener('click', (event) => {
    chrome.runtime.sendMessage({ action: 'system_runtime' }, ({ options, version }) => {
        if (options && version) {
            optionHistoryFlush();
            aria2ConfigSetup(options);
            tellVer.textContent = tellUA.textContent = version.version;
            extension.add('jsonrpc');
        }
    });
});

document.getElementById('goto-options').addEventListener('click', (event) => {
    optionHistoryFlush();
    aria2StorageSetup();
    extension.remove('jsonrpc');
});

function matchEventAddNew(id, list, entry) {
    let value = entry.value.match(/^(\*|[a-zA-Z0-9-]+)(\.(\*|[a-zA-Z0-9-]+))*$/)?.[0];
    let old_value = updated[id];
    entry.value = '';
    if (value && !old_value.includes(value)) {
        let new_value = [...old_value];
        let rule = printMatchPattern(list, id, value);
        new_value.push(value);
        list.scrollTop = list.scrollHeight;
        optionHistoryApply({ id, new_value, old_value, type: 'matches', add: { list, index: new_value.length, rule } });
    }
}

function matchEventResort(id, list) {
    let old_value = updated[id];
    let new_value = [...old_value].sort();
    let old_order = [...list.children];
    let new_order = [...old_order].sort((a, b) => a.textContent.localeCompare(b.textContent));
    list.append(...new_order);
    optionHistoryApply({ id, new_value, old_value, type: 'resort', list, new_order, old_order });
}

function matchEventRemove(id, list, _, event) {
    let rule = event.target.parentNode;
    let value = rule.title;
    let old_value = updated[id];
    let new_value = [...old_value];
    let index = new_value.indexOf(value);
    new_value.splice(index, 1);
    rule.remove();
    optionHistoryApply({ id, new_value, old_value, type: 'matches', remove: { list, index, rule } });
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

function aria2StorageSetup() {
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

function aria2StorageUpdate() {
    aria2Storage = { ...updated };
    chrome.runtime.sendMessage({ action: 'options_storage', params: updated });
}

chrome.runtime.sendMessage({ action: 'system_runtime'}, ({ storage, manifest }) => {
    aria2Storage = storage;
    aria2Version = manifest.version;
    aria2StorageSetup();
});
