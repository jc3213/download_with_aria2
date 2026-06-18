let aria2Storage = {};
let aria2Config = {};
let aria2Version;

let remote = false;
let changes = {};
let undoes = [];
let redoes = [];

let extension = document.body.classList;

let mainTree = document.body.children;
let menuPane = mainTree[0];
let storagePane = mainTree[1];
let jsonrpcPane = mainTree[2];
let template = mainTree[3];

let menuTree = menuPane.children;
let saveBtn = menuTree[0];
let undoBtn = menuTree[1];
let redoBtn = menuTree[2];
let tellVer = menuTree[3];
let importBtn = menuTree[4];
let exportBtn = menuTree[5];
let fileEntry = menuTree[6];
let exportFile = menuTree[7];

let tellUA = document.getElementById('useragent');
let storageEntries = storagePane.querySelectorAll('[name]');
let jsonrpcEntries = jsonrpcPane.querySelectorAll('[name]');
let controlEntries = new Set(storagePane.querySelectorAll('input.control'));
let matchLET = template.firstElementChild;

function saveChanges(change) {
    let id = change.id;
    let new_value = change.new_value;
    changes[id] = new_value;
    undoes.push(change);
    redoes = [];

    saveBtn.disabled = undoBtn.disabled = false;
    redoBtn.disabled = true;
}

storagePane.addEventListener('change', (event) => {
    let entry = event.target;
    let id = entry.name;

    if (!id) {
        return;
    }

    let type = entry.type;
    let new_value = entry.value;

    if (type === 'number') {
        new_value = new_value | 0;
    } else if (type === 'checkbox') {
        new_value = entry.checked;
        if (controlEntries.has(entry)) {
            extension.toggle(id);
        }
    }

    saveChanges({ id, new_value, old_value: changes[id], type, entry });
});

jsonrpcPane.addEventListener('change', (event) => {
    let entry = event.target;
    let id = entry.name;
    let new_value = entry.value;

    saveChanges({ id, new_value, old_value: changes[id], type: 'text', entry });
});

function storageUpdate() {
    aria2Storage = { ...changes };
    chrome.runtime.sendMessage({ action: 'update_storage', params: changes });
}

function loadChanges(loadList, saveList, loadButton, saveButton, key, todo) {
    let change = loadList.pop();
    let id = change.id;
    let type = change.type;
    let value = change[key];

    if (type === 'checkbox') {
        let entry = change.entry;

        if (controlEntries.has(entry)) {
            extension.toggle(id);
        }

        entry.checked = value;
    } else if (type === 'rules') {
        let add = change.add;
        let remove = change.remove;

        if (todo === 'undo') {
            if (add) {
                add.rule.remove();
            } else {
                remove.list.insertBefore(remove.rule, remove.list.children[remove.index]);
            }
        } else {
            if (add) {
                add.list.insertBefore(add.rule, add.list.children[add.index]);
            } else {
                remove.rule.remove();
            }
        }
    } else if (type === 'resort') {
        let sort = change.sort;
        let order = todo === 'undo' ? sort.old_order : sort.new_order;
        sort.list.append(...order);
    } else {
        change.entry.value = value;
    }

    changes[id] = value;
    saveList.push(change);
    loadButton.disabled = loadList.length === 0;
    saveButton.disabled = saveBtn.disabled = false;
}

function menuExport() {
    let name;
    let body;
    let time = new Date().toLocaleString('ja').replace(/[/ :]/g, '_');

    if (remote) {
        name = 'aria2_jsonrpc-' + time + '.conf';
        body = [];
        for (let i = 0, l = jsonrpcEntries.length; i < l; i++) {
            let key = jsonrpcEntries[i].name;
            body[i] = key + '=' + aria2Config[key] + '\n';
        }
    } else {
        name = 'downwitharia2-' + time + '.json';
        body = [JSON.stringify(aria2Storage, null, 4)];
    }

    let blob = new Blob(body);
    exportFile.href = URL.createObjectURL(blob);
    exportFile.download = name;
    exportFile.click();
}

menuPane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n');

    if (menu === 'options_save') {
        if (remote) {
            chrome.runtime.sendMessage({ action: 'update_jsonrpc', params: changes });
        } else {
            storageUpdate();
        }

        saveBtn.disabled = true;
        return;
    }

    if (menu === 'options_undo') {
        loadChanges(undoes, redoes, undoBtn, redoBtn, 'old_value', 'undo');
        return;
    }

    if (menu === 'options_redo') {
        loadChanges(redoes, undoes, redoBtn, undoBtn, 'new_value', 'redo');
        return;
    }

    if (menu === 'options_export') {
        menuExport();
        return;
    }

    if (menu === 'options_import') {
        fileEntry.accept = remote ? '.conf' : '.json';
        fileEntry.click();
        return;
    }
});

function importJson(file) {
    changes = JSON.parse(file);
    storageUpdate();
    storageDispatch();
}

function importConf(file) {
    let options = {};
    let lines = file.split('\n');

    for (let i = 0, l = lines.length; i < l; i++) {
        let line = lines[i];

        if (!line || line[0] === '#') {
            continue;
        }

        let arr = line.split('=');
        let key = arr[0];
        let value = arr[1];

        if (key in aria2Config && value) {
            options[key] = value.split('#')[0].trim();
        }
    }

    optionsDispatch(options);
    chrome.runtime.sendMessage({ action: 'update_jsonrpc', params: changes });
}

fileEntry.addEventListener('change', (event) => {
    let file = fileEntry.files[0];
    let reader = new FileReader();

    reader.onload = () => {
        changeHistoryFlush();
        fileEntry.accept === '.json' ? importJson(reader.result) : importConf(reader.result);
        fileEntry.value = '';
    };

    reader.readAsText(file);
});

function optionsDispatch(options) {
    for (let i = 0, l = jsonrpcEntries.length; i < l; i++) {
        let entry = jsonrpcEntries[i];
        let name = entry.name;
        entry.value = aria2Config[name] = options[name] || '';
    }

    changes = { ...aria2Config };
}

function changeHistoryFlush() {
    undoes = [];
    redoes = [];
    saveBtn.disabled = undoBtn.disabled = redoBtn.disabled = true;
}

document.getElementById('goto-jsonrpc').addEventListener('click', (event) => {
    chrome.runtime.sendMessage({ action: 'options_jsonrpc' }, (message) => {
        let version = message.version;

        if (!version) {
            return;
        }

        tellVer.textContent = tellUA.textContent = version.version;
        optionsDispatch(message.options);
        changeHistoryFlush();
        extension.add('jsonrpc');
        remote = true;
    });
});

document.getElementById('goto-options').addEventListener('click', (event) => {
    storageDispatch();
    changeHistoryFlush();
    extension.remove('jsonrpc');
    remote = false;
});

function matchAdd(id, entry) {
    let match = entry.value.match(/^(?:https?:\/\/|\/\/)?(\*|(?:[a-zA-Z0-9-]+\.)*[a-zA-Z0-9]+)(?=\/|$)/);
    entry.value = '';

    if (!match) {
        return;
    }

    addToList({ id, host: match[1] });
}

function matchResort(id, list) {
    let old_value = changes[id];
    let new_value = old_value.slice().sort();
    let old_order = Array.from(list.children);
    let new_order = old_order.slice().sort((a, b) => a.textContent.localeCompare(b.textContent));
    list.append(...new_order);
    saveChanges({ id, new_value, old_value, type: 'resort', sort: { list, new_order, old_order } });
}

const matchNodes = storagePane.querySelectorAll('div.flexmenu');
const matchLists = new Map();


for (let i = 0, l = matchNodes.length; i < l; i++) {
    let match = matchNodes[i];
    let id = match.id;
    let tree = match.children;
    let entry = tree[1];
    let list = tree[4];

    matchLists.set(id, list);

    match.addEventListener('click', (event) => {
        let menu = event.target.getAttribute('i18n-tips');

        if (menu === 'tips_match_add') {
            matchAdd(id, entry);
            return;
        }

        if (menu === 'tips_match_resort') {
            matchResort(id, list);
            return;
        }

        if (menu === 'tips_match_remove') {
            let host = event.target.parentNode.title;
            removeFromList({ id, host });
            return;
        }
    });

    entry.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            matchAdd(id, entry);
        }
    });
}

function printMatchPattern(list, id, value) {
    let rule = matchLET.cloneNode(true);
    rule.title = rule.firstElementChild.textContent = value;
    list.appendChild(rule);
    return rule;
}

function storageDispatch() {
    changes = { ...aria2Storage };
    tellVer.textContent = aria2Version;

    for (let i = 0, l = storageEntries.length; i < l; i++) {
        let entry = storageEntries[i];
        let type = entry.type;
        let name = entry.name;
        let value = changes[name];

        if (type === 'checkbox') {
            if (controlEntries.has(entry)) {
                value ? extension.add(name) : extension.remove(name);
            }

            entry.checked = value;
        } else {
            entry.value = value;
        }
    }

    for (let entries of matchLists) {
        let id = entries[0];
        let list = entries[1];
        let rules = changes[id];

        list.innerHTML = '';

        for (let i = 0, l = rules.length; i < l; i++) {
            printMatchPattern(list, id, rules[i]);
        }
    }
}

function addToList(add) {
    if (remote) {
        return;
    }

    let id = add.id;
    let host = add.host;
    let old_value = changes[id];

    if (old_value.includes(host)) {
        return;
    }

    let new_value = old_value.slice();
    let index = new_value.length;
    let list = matchLists.get(id).list;
    let rule = printMatchPattern(list, id, host);
    new_value[index] = host;

    list.scrollTop = list.scrollHeight;
    saveChanges({ id, new_value, old_value, type: 'rules', add: { list, index, rule } });
}

function removeFromList(remove) {
    if (remote) {
        return;
    }

    let id = remove.id;
    let host = remove.host;
    let list = matchLists.get(id).list;
    let old_value = changes[id];
    let index = old_value.indexOf(host);
    let new_value = old_value.slice();
    let rule = list.querySelector('[title="' + host + '"]');
    new_value.splice(index, 1);

    rule.remove();
    saveChanges({ id, new_value, old_value, type: 'rules', remove: { list, index, rule } });
}

chrome.runtime.onMessage.addListener((message) => {
    let action = message.options;
    let params = message.params;

    if (action === 'match_add') {
        addToList(params);
        return;
    }

    if (action === 'match_remove') {
        removeFromList(params);
        return;
    }
});


chrome.runtime.sendMessage({ action: 'options_runtime'}, (message) => {
    let system = message.system;
    aria2Storage = message.storage;
    aria2Version = system.version;

    if (system.browser_specific_settings) {
        extension.add('firefox');
    }

    storageDispatch();
});
