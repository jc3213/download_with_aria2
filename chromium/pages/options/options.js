var aria2Storage = {};
var aria2Config = {};
var aria2Version;

var updated = {};
var changes = {};
var undoes = [];
var undone = false;
var redoes = [];

var extension = document.body.classList;
var [saveBtn, undoBtn, redoBtn, aria2ver, exportBtn, importBtn, jsonFile, confFile, exporter] = document.querySelectorAll('#menu > *')
var [jsonrpcBtn, optionsBtn, aria2ua] = document.querySelectorAll('#goto-jsonrpc, #goto-options, #useragent');
var optionsEntries = document.querySelectorAll('#options [name]:not([type="checkbox"])');
var optionsCheckboxes = document.querySelectorAll('[type="checkbox"]');
var optionsMatches = document.querySelectorAll('.matches > [id]');
var jsonrpcEntries = document.querySelectorAll('#jsonrpc [name]');
var matchLET = document.querySelector('.template > div');

if (typeof browser !== 'undefined') {
    extension.add('firefox');
    var [folderff, captureen, captureff] = document.querySelectorAll('#folder_firefox, #capture_enabled, #capture_webrequest');
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

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey) {
        switch (event.key) {
            case 's':
                event.preventDefault();
                saveBtn.click();
                break;
            case 'z':
                event.preventDefault();
                undoBtn.click();
                break;
            case 'y':
                event.preventDefault();
                redoBtn.click();
                break;
        }
    }
});

saveBtn.addEventListener('click', (event) => {
    saveBtn.disabled = true;
    extension.contains('jsonrpc') ? chrome.runtime.sendMessage({action: 'jsonrpc_onchange', params: changes}) : aria2SaveStorage(updated);
});

undoBtn.addEventListener('click', (event) => {
    var undo = undoes.pop();
    redoes.push(undo);
    var {id, old_value} = undo;
    updated[id] = changes[id] = old_value;
    optionsUndoRedo('undo', old_value, undo);
    saveBtn.disabled = redoBtn.disabled = false;
    undone = true;
    if (undoes.length === 0) {
        undoBtn.disabled = true;
    }
});

redoBtn.addEventListener('click', (event) => {
    var redo = redoes.pop();
    undoes.push(redo);
    var {id, new_value} = redo;
    updated[id] = changes[id] = new_value;
    optionsUndoRedo('redo', new_value, redo);
    saveBtn.disabled = undoBtn.disabled = false;
    if (redoes.length === 0) {
        redoBtn.disabled = true;
    }
});

function optionsUndoRedo(action, value, {add, checkbox, entry, id, remove, resort}) {
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
        self[action + 'MatchRule'](add, remove);
    }
}

function undoResort({list, old_order}) {
    list.append(...old_order);
}

function redoResort({list, new_order}) {
    list.append(...new_order);
}

function undoMatchRule(add, remove) {
    add?.forEach(({rule}) => rule.remove());
    remove?.forEach(({list, index, rule}) => list.insertBefore(rule, list.children[index]));
}

function redoMatchRule(add, remove) {
    add?.forEach(({list, index, rule}) => list.insertBefore(rule, list.children[index]));
    remove?.forEach(({rule}) => rule.remove());
}

exportBtn.addEventListener('click', (event) => {
    if (extension.contains('jsonrpc')) {
        var name = 'aria2_jsonrpc';
        var type = 'conf';
        var body = Object.keys(aria2Config).map((key) => key + '=' + aria2Config[key]);
    } else {
        name = 'downwitharia2';
        type = 'json';
        body = [JSON.stringify(aria2Storage, null, 4)];
    }
    var time = new Date().toLocaleString('ja').replace(/[\/\s:]/g, '_');
    var blob = new Blob(body);
    exporter.href = URL.createObjectURL(blob);
    exporter.download = name + '-' + time + '.' + type;
    exporter.click();
});

importBtn.addEventListener('click', (event) => {
    extension.contains('jsonrpc') ? confFile.click() : jsonFile.click();
});

jsonFile.addEventListener('change', async (event) => {
    var file = await promiseFileReader(event.target.files[0]);
    changes = JSON.parse(file);
    aria2SaveStorage(changes);
    aria2OptionsSetup();
    optionEmptyChanges();
    event.target.value = '';
});

confFile.addEventListener('change', async (event) => {
    var file = await promiseFileReader(event.target.files[0]);
    var params = {};
    file.split('\n').forEach((line) => {
        if (line[0] !== '#') {
            var [key, value] = line.split('=');
            params[key] = value;
        }
    });
    chrome.runtime.sendMessage({action: 'jsonrpc_onchange', params});
    aria2ConfigSetup(params);
    updated = {...aria2Config};
    optionEmptyChanges();
    event.target.value = '';
});

function promiseFileReader(file) {
    return new Promise((resolve) => {
        var reader = new FileReader();
        reader.onload = (event) => resolve(reader.result);
        reader.readAsText(file);
    });
}

function aria2ConfigSetup(json) {
    jsonrpcEntries.forEach((entry) => {
        entry.value = aria2Config[entry.name] = json[entry.name] ?? '';
    });
}

function optionEmptyChanges() {
    undoes = [];
    redoes = [];
    saveBtn.disabled = undoBtn.disabled = redoBtn.disabled = true;
}

jsonrpcBtn.addEventListener('click', (event) => {
    chrome.runtime.sendMessage({action: 'jsonrpc_handshake'}, ({alive, options, version}) => {
        if (alive) {
            optionEmptyChanges();
            aria2ConfigSetup(options);
            updated = {...aria2Config};
            aria2ver.textContent = aria2ua.textContent = version;
            extension.add('jsonrpc');
        }
    });
});

optionsBtn.addEventListener('click', (event) => {
    optionEmptyChanges();
    aria2OptionsSetup();
    extension.remove('jsonrpc');
});

[...optionsEntries, ...jsonrpcEntries].forEach((entry) => {
    entry.addEventListener('change', (event) => {
        var id = entry.name;
        var new_value = entry.value;
        optionsChangeApply(id, new_value, {entry, id, new_value, old_value: updated[id]});
    });
});

optionsCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
        var id = checkbox.name;
        var new_value = checkbox.checked;
        if (checkbox.dataset.key) {
            extension.toggle(id);
        }
        optionsChangeApply(id, new_value, {checkbox, id, new_value, old_value: !new_value});
    });
});

optionsMatches.forEach((match) => {
    var id = match.id;
    var [entry, addbtn, resort, list] = match.querySelectorAll('input, button, .list');
    match.list = list;
    entry.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            addMatchPattern(list, id, entry);
        }
    });
    addbtn.addEventListener('click', (event) => addMatchPattern(list, id, entry));
    resort.addEventListener('click', (event) => resortMatchPattern(list, id));
});

function optionsChangeApply(id, new_value, undo) {
    updated[id] = changes[id] = new_value;
    undoes.push(undo);
    saveBtn.disabled = undoBtn.disabled = false;
    if (undone) {
        redoes = [];
        undone = false;
        redoBtn.disabled = true;
    }
}

function createMatchPattern(list, id, value) {
    var rule = matchLET.cloneNode(true);
    var [content, purge] = rule.querySelectorAll('*');
    content.textContent = rule.title = value;
    purge.addEventListener('click', (event) => removeMatchPattern(list, id, event.target.parentNode));
    list.appendChild(rule);
    return rule;
}

function addMatchPattern(list, id, entry) {
    var old_value = updated[id];
    var new_value = [...old_value];
    var add = [];
    entry.value.match(/[^\s;]+/g)?.forEach((value) => {
        if (value && !new_value.includes(value)) {
            var rule = createMatchPattern(list, id, value);
            add.push({list, index: new_value.length, rule});
            new_value.push(value);
        }
    });
    entry.value = '';
    list.scrollTop = list.scrollHeight;
    optionsChangeApply(id, new_value, {add, id, new_value, old_value});
}

function resortMatchPattern(list, id) {
    var old_value = updated[id];
    var new_value = [...old_value].sort();
    var old_order = [...list.children];
    var new_order = [...old_order].sort((a, b) => a.textContent.localeCompare(b.textContent));
    list.append(...new_order);
    optionsChangeApply(id, new_value, {id, new_value, old_value, resort: {list, new_order, old_order}});
}

function removeMatchPattern(list, id, rule) {
    var old_value = updated[id]
    var new_value = [...old_value];
    var index = new_value.indexOf(rule.title);
    new_value.splice(index, 1);
    rule.remove();
    optionsChangeApply(id, new_value, {id, new_value, old_value, remove: [{list, index, rule}]});
}

function aria2OptionsSetup() {
    updated = {...aria2Storage};
    aria2ver.textContent = aria2Version;
    optionsEntries.forEach((entry) => {
        entry.value = updated[entry.name];
    });
    optionsCheckboxes.forEach((checkbox) => {
        var id = checkbox.name;
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

function aria2SaveStorage(json) {
    json['jsonrpc_retries'] = json['jsonrpc_retries'] | 0;
    json['jsonrpc_timeout'] = json['jsonrpc_timeout'] | 0;
    json['manager_interval'] = json['manager_interval'] | 0;
    json['capture_size_include'] = json['capture_size_include'] | 0;
    json['capture_size_exclude'] = json['capture_size_exclude'] | 0;
    chrome.runtime.sendMessage({action: 'options_onchange', params: {storage: json, changes}});
    aria2Storage = json;
    changes = {};
}

chrome.runtime.sendMessage({action: 'options_plugins'}, ({storage, manifest}) => {
    aria2Storage = storage;
    aria2Version = manifest.version;
    aria2OptionsSetup();
});
