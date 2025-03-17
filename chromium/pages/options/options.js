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
let [jsonrpcBtn, optionsBtn, tellUA] = document.querySelectorAll('#goto-jsonrpc, #goto-options, #useragent');
let optionsEntries = document.querySelectorAll('#options [name]:not([type="checkbox"])');
let optionsCheckboxes = document.querySelectorAll('[type="checkbox"]');
let optionsMatches = document.querySelectorAll('.matches div[id]');
let jsonrpcEntries = document.querySelectorAll('#jsonrpc [name]');
let matchLET = template.children[0];

if (typeof browser !== 'undefined') {
    extension.add('firefox');
    let [folderff, captureen, captureff] = document.querySelectorAll('#folder_firefox, #capture_enabled, #capture_webrequest');
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

function optionsUndoRedo(action, value, {add, checkbox, entry, id, remove, resort}) {
    updated[id] = value;
    if (entry) {
        entry.value = value;
    } else if (checkbox) {
        if (checkbox.dataset.key) {
            extension.toggle(id);
        }
        checkbox.checked = value;
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
    if (extension.contains('jsonrpc')) {
        let name = 'aria2_jsonrpc';
        let type = 'conf';
        let body = Object.keys(aria2Config).map((key) => key + '=' + aria2Config[key]);
    } else {
        name = 'downwitharia2';
        type = 'json';
        body = [JSON.stringify(aria2Storage, null, 4)];
    }
    let time = new Date().toLocaleString('ja').replace(/[\/\s:]/g, '_');
    let blob = new Blob(body);
    exporter.href = URL.createObjectURL(blob);
    exporter.download = name + '-' + time + '.' + type;
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

jsonrpcBtn.addEventListener('click', (event) => {
    chrome.runtime.sendMessage({action: 'jsonrpc_handshake'}, ({alive, options, version}) => {
        if (alive) {
            optionsHistoryFlushed();
            aria2ConfigSetup(options);
            tellVer.textContent = tellUA.textContent = version;
            extension.add('jsonrpc');
        }
    });
});

optionsBtn.addEventListener('click', (event) => {
    optionsHistoryFlushed();
    aria2StorageSetup();
    extension.remove('jsonrpc');
});

[...optionsEntries, ...jsonrpcEntries].forEach((entry) => {
    entry.addEventListener('change', (event) => {
        let id = entry.name;
        let new_value = entry.value;
        optionsHistoryLogged({entry, id, new_value, old_value: updated[id]});
    });
});

optionsCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
        let id = checkbox.name;
        let new_value = checkbox.checked;
        if (checkbox.dataset.key) {
            extension.toggle(id);
        }
        optionsHistoryLogged({checkbox, id, new_value, old_value: !new_value});
    });
});

optionsMatches.forEach((match) => {
    let id = match.id;
    let [menu, list] = match.children;
    let [, entry, addbtn, resort] = menu.children;
    match.list = list;
    entry.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            addbtn.click();
        }
    });
    addbtn.addEventListener('click', (event) => {
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
        optionsHistoryLogged({add, id, new_value, old_value});
    });
    resort.addEventListener('click', (event) => {
        let old_value = updated[id];
        let new_value = [...old_value].sort();
        let old_order = [...list.children];
        let new_order = [...old_order].sort((a, b) => a.textContent.localeCompare(b.textContent));
        list.append(...new_order);
        optionsHistoryLogged({id, new_value, old_value, resort: {list, new_order, old_order}});
    });
});

function optionsHistoryLogged(undo) {
    updated[undo.id] = undo.new_value;
    undoes.push(undo);
    saveBtn.disabled = undoBtn.disabled = false;
    if (undone) {
        redoes = [];
        undone = false;
        redoBtn.disabled = true;
    }
}

function createMatchPattern(list, id, value) {
    let rule = matchLET.cloneNode(true);
    let [content, purge] = rule.children;
    content.textContent = rule.title = value;
    purge.addEventListener('click', (event) => {
        let old_value = updated[id]
        let new_value = [...old_value];
        let index = new_value.indexOf(rule.title);
        new_value.splice(index, 1);
        rule.remove();
        optionsHistoryLogged({id, new_value, old_value, remove: [{list, index, rule}]});
    });
    list.appendChild(rule);
    return rule;
}

function aria2StorageSetup() {
    updated = {...aria2Storage};
    tellVer.textContent = aria2Version;
    optionsEntries.forEach((entry) => {
        entry.value = updated[entry.name];
    });
    optionsCheckboxes.forEach((checkbox) => {
        let id = checkbox.name;
        if (checkbox.dataset.key) {
            updated[id] ? extension.add(id) : extension.remove(id);
        }
        checkbox.checked = updated[id];
    });
    optionsMatches.forEach(({id, list}) => {
        list.innerHTML = '';
        updated[id].forEach((value) => createMatchPattern(list, id, value));
    });
}

function aria2StorageUpdate() {
    aria2Storage = {...updated};
    updated['jsonrpc_retries'] = updated['jsonrpc_retries'] | 0;
    updated['jsonrpc_timeout'] = updated['jsonrpc_timeout'] | 0;
    updated['manager_interval'] = updated['manager_interval'] | 0;
    updated['capture_size_include'] = updated['capture_size_include'] | 0;
    updated['capture_size_exclude'] = updated['capture_size_exclude'] | 0;
    chrome.runtime.sendMessage({action: 'storage_update', params: updated});
}

chrome.runtime.sendMessage({action: 'storage_query'}, ({storage, manifest}) => {
    aria2Storage = storage;
    aria2Version = manifest.version;
    aria2StorageSetup();
});
