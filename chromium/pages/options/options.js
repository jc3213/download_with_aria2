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
    firefoxExclusive();
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

function optionHistoryApply(id, new_value, old_value, type, props) {
    updated[id] = new_value;
    undoes.push({ ...props, id, new_value, old_value, type });
    saveBtn.disabled = undoBtn.disabled = false;
    if (undone) {
        redoes = [];
        undone = false;
        redoBtn.disabled = true;
    }
}

optionsPane.addEventListener('change', (event) => {
    let entry = event.target;
    let { name, type, value, checked } = entry;
    if (!name) {
        return;
    }
    switch (type) {
        case 'number': 
            value = value | 0;
            break;
        case 'checkbox':
            value = checked;
            if (entry.hasAttribute('data-css')) {
                extension.toggle(name);
            }
            break;
    };
    optionHistoryApply(name, value, updated[name], type, { entry });
});

jsonrpcPane.addEventListener('change', (event) => {
    let entry = event.target;
    let {name, value} = event.target;
    optionHistoryApply(name, value, updated[name], 'text', { entry });
});

function menuEventSave() {
    saveBtn.disabled = true;
    extension.contains('jsonrpc') ? chrome.runtime.sendMessage({action: 'jsonrpc_update', params: updated}) : aria2StorageUpdate();
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
    'checkbox': ({ entry, value }) => {
        if (entry.hasAttribute('data-css')) {
            extension.toggle(id);
        }
        entry.checked = value;
    },
    'matches': ({ add, remove }, action) => {
        if (action === 'undo') {
            add?.forEach(({rule}) => rule.remove());
            remove?.forEach(({list, index, rule}) => list.insertBefore(rule, list.children[index]));
        } else {
            add?.forEach(({list, index, rule}) => list.insertBefore(rule, list.children[index]));
            remove?.forEach(({rule}) => rule.remove());
        }
    },
    'resort': ({ list, old_order, new_order }, action) => {
        action === 'undo' ? list.append(...old_order) : list.append(...new_order);
    }
};

function optionHistoryLoad(action, key, {id, type, ...props}) {
    let value = props.value = props[key];
    let handler = optionHandlers[type] ?? optionHandlers['string'];
    handler(props, action);
    updated[id] = value;
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

const menuEventMap = {
    'common_save': menuEventSave,
    'option_undo': menuEventUndo,
    'option_redo': menuEventRedo,
    'option_export': menuEventExport,
    'option_import': menuEventImport,
};

menuPane.addEventListener('click', (event) => {
    let menu = menuEventMap[event.target.getAttribute('i18n')];
    menu?.();
});

jsonFile.addEventListener('change', async (event) => {
    optionHistoryFlush();
    let file = await promiseFileReader(event.target.files[0]);
    updated = JSON.parse(file);
    aria2StorageUpdate();
    aria2StorageSetup();
    event.target.value = '';
});

confFile.addEventListener('change', async (event) => {
    optionHistoryFlush();
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

function optionHistoryFlush() {
    undoes = [];
    redoes = [];
    saveBtn.disabled = undoBtn.disabled = redoBtn.disabled = true;
}

document.getElementById('goto-jsonrpc').addEventListener('click', (event) => {
    chrome.runtime.sendMessage({action: 'system_runtime'}, ({options, version}) => {
        if (options && version) {
            optionHistoryFlush();
            aria2ConfigSetup(options);
            tellVer.textContent = tellUA.textContent = version;
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
    optionHistoryApply(id, new_value, old_value, 'matches', { add });
}

function matchEventResort(id, list) {
    let old_value = updated[id];
    let new_value = [...old_value].sort();
    let old_order = [...list.children];
    let new_order = [...old_order].sort((a, b) => a.textContent.localeCompare(b.textContent));
    list.append(...new_order);
    optionHistoryApply(id, new_value, old_value, 'resort', { list, new_order, old_order });
}

function matchEventRemove(id, list, rule) {
    let value = rule.title;
    let old_value = updated[id];
    let new_value = [...old_value];
    let index = old_value.indexOf(value);
    new_value.splice(index, 1);
    rule.remove();
    optionHistoryApply(id, new_value, old_value, 'matches', { remove: [{list, index, rule}] });
}

const matchEventMap = {
    'tips_match_addnew': (id, list, entry) => matchEventAddNew(id, list, entry),
    'tips_match_resort': (id, list) => matchEventResort(id, list),
    'tips_match_remove': (id, list, entry, event) => matchEventRemove(id, list, event.target.parentNode),
};

optionsMatches.forEach((match) => {
    let { id } = match;
    let [menu, list] = match.children;
    let entry = menu.children[1];
    match.list = list;
    match.addEventListener('click', (event) => {
        let action = matchEventMap[event.target.getAttribute('i18n-tips')];
        action?.(id, list, entry, event);
    });
    entry.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            matchEventAddNew(id, list, entry);
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
