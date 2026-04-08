let aria2Storage = {};
let aria2Config = {};
let aria2Associate = new Map();
let aria2Version;
let activeFileType;

let toggle = false;
let changes = {};
let undoes = [];
let redoes = [];

let extension = document.body.classList;
let [menuPane, storagePane, jsonrpcPane, template] = document.body.children;
let [saveBtn, undoBtn, redoBtn, tellVer, importBtn, exportBtn, fileEntry, exportFile] = menuPane.children;
let tellUA = document.getElementById('useragent');
let storageEntries = storagePane.querySelectorAll('[name]');
let jsonrpcEntries = jsonrpcPane.querySelectorAll('[name]');
let [assocPane, ...matchPanes] = storagePane.querySelectorAll('div.flexmenu');
let [, addFileTypeBtn, fileTypeList, fileTypeModal] = assocPane.children;
let [, fileTypeNameInput, fileTypeExtensionsInput] = fileTypeModal.children;
let [matchLET, assocLET] = template.children;

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
    } else if (type === 'folder_associate' && fileTypeList) {
        fileTypeList.innerHTML = '';
        for (let [typeName, extensions] of value) {
            printFileType(fileTypeList, typeName, extensions);
        }
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
    exportFile.href = URL.createObjectURL(blob);
    exportFile.download = name;
    exportFile.click();
}

function menuEventImport() {
    fileEntry.accept = toggle ? '.conf' : '.json';
    fileEntry.click();
}

const menuEventMap = {
    'options_save': menuEventSave,
    'options_undo': () => changeHistoryLoad(undoes, redoes, undoBtn, redoBtn, 'old_value', 'undo'),
    'options_redo': () => changeHistoryLoad(redoes, undoes, redoBtn, undoBtn, 'new_value', 'redo'),
    'options_export': menuEventExport,
    'options_import': menuEventImport
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

const fileTypes = {
    'tips_add_file_type': addFileType,
    'tips_save_file_type': saveFileType,
    'tips_cancel_file_type': cancelFileType,
    'tips_edit_file_type': editFileType,
    'tips_remove_file_type': removeFileType
};

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

for (let match of matchPanes) {
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
    rule.title = rule.firstElementChild.textContent = value;
    list.appendChild(rule);
    return rule;
}

function printFileType(list, typeName, extensions) {
    let rule = assocLET.cloneNode(true);
    let [type, apps] = rule.children;
    type.textContent = typeName;
    apps.textContent = extensions.join(', ');
    list.appendChild(rule);
    return rule;
}

function addFileType() {
    fileTypeModal.classList.remove('hidden');
    fileTypeNameInput.value = fileTypeExtensionsInput.value = '';
}

function cancelFileType() {
    fileTypeModal.classList.add('hidden');
}

function removeFileType(button) {
    let rule = button.parentNode;
    let type = rule.firstElementChild.textContent;
    let old_value = changes['folder_associate'];
    let new_value = old_value.slice();
    let index = aria2Storage['folder_associate'].findIndex((i) => i[0] === type);
    new_value.splice(index, 1);
    rule.remove();
    changeHistorySave({ id: 'folder_associate', new_value, old_value, type: 'folder_associate' });
}

function editFileType(rule) {
    currentFileTypeOperation = 'edit';
    currentEditType = typeName;
    modalTitle.textContent = 'Edit File Type';
    fileTypeNameInput.value = typeName;
    fileTypeExtensionsInput.value = extensions.join(', ');
    fileTypeModal.style.display = 'block';
}

function saveFileType() {
    let typeName = fileTypeNameInput.value.trim();
    let extensionsInput = fileTypeExtensionsInput.value.trim().toLowerCase();
    if (!typeName || !extensionsInput) {
        return;
    }
    let extensions = extensionsInput.split(',').map(ext => ext.trim()).filter(Boolean);
    let old_value = changes['folder_associate'];
    let new_value = old_value.slice();
    
    if (Number.isInteger(activeFileType)) {
        new_value[activeFileType] = [typeName, extensions];
        activeFileType = null;
    } else {
        new_value.push([typeName, extensions]);
    }
    
    fileTypeList.innerHTML = '';
    for (let [type, exts] of new_value) {
        printFileType(fileTypeList, type, exts);
    }
    changeHistorySave({ id: 'folder_associate', new_value, old_value, type: 'folder_associate' });
    fileTypeModal.classList.add('hidden');
    fileTypeList.scrollTop = fileTypeList.scrollHeight;
}

assocPane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n-tips');
    fileTypes[menu]?.(event.target);
});

fileTypeExtensionsInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        addFileType();
    }
});

fileTypeList.addEventListener('click', (event) => {
    if (event.target.getAttribute('i18n-tips') === 'tips_match_remove') {
        removeFileType(event);
    }
});

window.addEventListener('click', (event) => {
    if (event.target === fileTypeModal) {
        cancelFileType();
    }
});

window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && fileTypeModal && fileTypeModal.style.display === 'block') {
        cancelFileType();
    }
});

function storageDispatch() {
    changes = { ...aria2Storage };
    aria2Associate = new Map(changes['folder_associate']);
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

    fileTypeList.innerHTML = '';
    for (let [type, extensions] of aria2Associate) {
        printFileType(fileTypeList, type, extensions);
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
