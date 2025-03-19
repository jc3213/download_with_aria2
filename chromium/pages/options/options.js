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

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.querySelectorAll('[i18n-tips]').forEach((node) => {
    node.title = chrome.i18n.getMessage(node.getAttribute('i18n-tips'));
});

const shortcutHandlers = {
    's': saveBtn,
    'z': undoBtn,
    'y': redoBtn
};

document.addEventListener('keydown', (event) => {
    let handler = shortcutHandlers[event.key];
    if (event.ctrlKey && handler) {
        event.preventDefault();
        handler.click();
    }
});

const optionsValueHandlers = {
    'text': (entry, id, value) => optionsHistoryLogged(id, value, {entry}),
    'number': (entry, id, value) => optionsHistoryLogged(id, value | 0, {entry}),
    'checkbox': (check, id, _, value) => {
        if (check.dataset.key) {
            extension.toggle(id);
        }
        optionsHistoryLogged(id, value, {check});
    }
}

function optionsHistoryLogged(id, new_value, undo) {
    undo.old_value ??= updated[id];
    updated[id] = new_value;
    undoes.push({id, new_value, ...undo});
    saveBtn.disabled = undoBtn.disabled = false;
    if (undone) {
        redoes = [];
        undone = false;
        redoBtn.disabled = true;
    }
}

document.addEventListener('change', (event) => {
    let entry = event.target;
    let {name, value, type, checked} = entry;
    if (name) {
        optionsValueHandlers[type](entry, name, value, checked);
    }
});

saveBtn.addEventListener('click', (event) => {
    saveBtn.disabled = true;
    extension.contains('jsonrpc') ? chrome.runtime.sendMessage({action: 'jsonrpc_update', params: updated}) : aria2StorageUpdate();
});

undoBtn.addEventListener('click', (event) => {
    let undo = undoes.pop();
    redoes.push(undo);
    optionsUndoRedo('undo', undo.old_value, undo);
    saveBtn.disabled = redoBtn.disabled = false;
    undone = true;
    if (undoes.length === 0) {
        undoBtn.disabled = true;
    }
});

redoBtn.addEventListener('click', (event) => {
    let redo = redoes.pop();
    undoes.push(redo);
    optionsUndoRedo('redo', redo.new_value, redo);
    saveBtn.disabled = undoBtn.disabled = false;
    if (redoes.length === 0) {
        redoBtn.disabled = true;
    }
});

function optionsUndoRedo(action, value, {add, check, entry, id, remove, resort}) {
    updated[id] = value;
    if (entry) {
        entry.value = value;
    } else if (check) {
        if (check.dataset.key) {
            extension.toggle(id);
        }
        check.checked = value;
    } else if (resort) {
        self[action + 'Resort'](resort);
    } else {
        self[action + 'MatchPattern'](add, remove);
    }
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

exportBtn.addEventListener('click', (event) => {
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
});

importBtn.addEventListener('click', (event) => {
    extension.contains('jsonrpc') ? confFile.click() : jsonFile.click();
});

jsonFile.addEventListener('change', async (event) => {
    optionsHistoryFlushed();
    let file = await promiseFileReader(event.target.files[0]);
    updated = JSON.parse(file);
    aria2StorageUpdate();
    aria2StorageSetup();
    event.target.value = '';
});

confFile.addEventListener('change', async (event) => {
    optionsHistoryFlushed();
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

function optionsHistoryFlushed() {
    undoes = [];
    redoes = [];
    saveBtn.disabled = undoBtn.disabled = redoBtn.disabled = true;
}

document.getElementById('goto-jsonrpc').addEventListener('click', (event) => {
    chrome.runtime.sendMessage({action: 'jsonrpc_handshake'}, ({alive, options, version}) => {
        if (alive) {
            optionsHistoryFlushed();
            aria2ConfigSetup(options);
            tellVer.textContent = tellUA.textContent = version;
            extension.add('jsonrpc');
        }
    });
});

document.getElementById('goto-options').addEventListener('click', (event) => {
    optionsHistoryFlushed();
    aria2StorageSetup();
    extension.remove('jsonrpc');
});

const matchEventHandlers = {
    'tips_match_addnew': matchEventAddNew,
    'tips_match_resort': matchEventResort,
    'tips_match_remove': matchEventRemove
};

function matchEventAddNew(event, {id, list, entry}) {
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
    optionsHistoryLogged(id, new_value, {old_value, add});
}

function matchEventResort(event, {id, list}) {
    let old_value = updated[id];
    let new_value = [...old_value].sort();
    let old_order = [...list.children];
    let new_order = [...old_order].sort((a, b) => a.textContent.localeCompare(b.textContent));
    list.append(...new_order);
    optionsHistoryLogged(id, new_value, {old_value, resort: {list, new_order, old_order}});
}

function matchEventRemove(event, {id, list}) {
    let rule = event.target.parentNode;
    let value = rule.title;
    let old_value = updated[id];
    let new_value = [...old_value];
    let index = old_value.indexOf(value);
    new_value.splice(index, 1);
    rule.remove();
    optionsHistoryLogged(id, new_value, {old_value, remove: [{list, index, rule}]});
}

optionsMatches.forEach((match) => {
    let id = match.id;
    let [menu, list] = match.children;
    let entry = menu.children[1];
    match.list = list;
    match.addEventListener('click', (event) => {
        let handler = matchEventHandlers[event.target.getAttribute('i18n-tips')];
        if (handler) {
            handler(event, {id, list, entry});
        }
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

chrome.runtime.sendMessage({action: 'storage_query'}, ({storage, manifest}) => {
    aria2Storage = storage;
    aria2Version = manifest.version;
    aria2StorageSetup();
});
