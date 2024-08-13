var aria2Storage = {};
var aria2Global = {};
var aria2Conf = {};
var aria2Version;
var updated = {};
var changes = {};
var undoes = [];
var undone = false;
var redoes = [];
var global = true;
var extension = document.body.classList;
var {version, manifest_version} = chrome.runtime.getManifest();
var [saveBtn, undoBtn, redoBtn, aria2ver, exportBtn, exporter, aria2ua] = document.querySelectorAll('#menu > :nth-child(-n+6), #aria2ua');
var options = document.querySelectorAll('[data-eid]');
var jsonrpc = document.querySelectorAll('[data-rid]');
var matches = document.querySelectorAll('[data-map]');
var ruleLET = document.querySelector('.template > .rule');
var entries = {};
var records = {};
var switches = {
    'context_enabled': true,
    'context_cascade': false,
    'context_thisurl': false,
    'context_thisimage': false,
    'context_allimages': false,
    'manager_newtab': false,
    'notify_install': false,
    'notify_start': false,
    'notify_complete': false,
    'headers_override': true,
    'folder_enabled': true,
    'folder_firefox': false,
    'capture_enabled': true,
    'capture_webrequest': true
};

options.forEach((entry) => {
    entries[entry.dataset.eid] = entry;
});

matches.forEach((match) => {
    var id = match.dataset.map;
    var [entry, list] = match.querySelectorAll('input, .list');
    match.addEventListener('keydown', ({key}) => {
        if (key === 'Enter') {
            addMatchRule(list, id, entry);
        }
    });
    match.addEventListener('click', (event) => {
        switch (event.target.dataset.bid) {
            case 'add_rule':
                addMatchRule(list, id, entry);
                break;
            case 'remove_rule':
                removeMatchRule(list, id, event.target.dataset.mid);
                break;
        }
    });
    records[id] = list;
});

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

document.addEventListener('click', (event) => {
    switch (event.target.dataset.bid) {
        case 'save_btn':
            optionsSave();
            break;
        case 'undo_btn':
            optionsUndo();
            break;
        case 'redo_btn':
            optionsRedo();
            break;
        case 'export_btn':
            optionsExport();
            break;
        case 'aria2_btn':
            optionsJsonrpc();
            break;
        case 'back_btn':
            optionsExtension();
            break;
    }
});

async function optionsSave() {
    saveBtn.disabled = true;
    global ? aria2SaveStorage(updated) : chrome.runtime.sendMessage({action: 'jsonrpc_onchange', params: {jsonrpc: changes}});
}

function optionsUndo() {
    var undo = undoes.pop();
    redoes.push(undo);
    var {id, old_value} = undo;
    updated[id] = changes[id] = old_value;
    records[id] ? undoMatchRule(undo) : optionsValueUpdate(id, old_value);
    saveBtn.disabled = redoBtn.disabled = false;
    undone = true;
    if (undoes.length === 0) {
        undoBtn.disabled = true;
    }
}

function optionsRedo() {
    var redo = redoes.pop();
    undoes.push(redo);
    var {id, new_value} = redo;
    updated[id] = changes[id] = new_value;
    records[id] ? redoMatchRule(redo) : optionsValueUpdate(id, new_value);
    saveBtn.disabled = undoBtn.disabled = false;
    if (redoes.length === 0) {
        redoBtn.disabled = true;
    }
}

function optionsValueUpdate(id, value) {
    var entry = entries[id];
    if (id in switches) {
        entry.checked = value;
        if (switches[id]) {
            extension.toggle(id);
        }
        return;
    }
    entry.value = value;
}

function optionsExport() {
    var time = new Date().toLocaleString('ja').replace(/[\/\s:]/g, '_');
    if (global) {
        var output = [JSON.stringify(aria2Storage, null, 4)];
        var name = 'downwitharia2_options-' + time + '.json';
    }
    else {
        output = Object.keys(aria2Conf).map((key) => key + '=' + aria2Conf[key] + '\n');
        name = 'aria2c_jsonrpc-' + time + '.conf';
    }
    var blob = new Blob(output);
    exporter.href = URL.createObjectURL(blob);
    exporter.download = name;
    exporter.click();
}

async function optionsJsonrpc() {
    if (!aria2Version) {
        return;
    }
    optionEmptyChanges();
    global = false;
    aria2Global = jsonrpc.disposition(aria2Conf);
    updated = {...aria2Global};
    aria2ver.textContent = aria2ua.textContent = aria2Version;
    extension.add('jsonrpc');
}

function optionsExtension() {
    optionEmptyChanges();
    global = true;
    aria2OptionsSetUp();
    extension.remove('jsonrpc');
}

function optionEmptyChanges() {
    undoes = [];
    redoes = [];
    saveBtn.disabled = undoBtn.disabled = redoBtn.disabled = true;
}

document.getElementById('files').addEventListener('change', (event) => {
    optionsImport(event.files[0]);
    event.target.value = '';
});

document.getElementById('options').addEventListener('change', (event) => {
    var id = event.target.dataset.eid;
    optionsAddChange(id, id in switches ? event.target.checked : event.target.value);
});

document.getElementById('jsonrpc').addEventListener('change', (event) => {
    optionsAddChange(event.target.dataset.rid, event.target.value);
});

function optionsAddChange(id, new_value) {
    undoes.push({id, old_value: updated[id], new_value});
    if (switches[id]) {
        extension.toggle(id);
    }
    optionsCheckUndone(id, new_value);
}

function optionsCheckUndone(id, new_value) {
    updated[id] = changes[id] = new_value;
    saveBtn.disabled = undoBtn.disabled = false;
    if (undone) {
        redoes = [];
        undone = false;
        redoBtn.disabled = true;
    }
}

function optionsImport(file) {
    optionEmptyChanges();
    var reader = new FileReader();
    reader.onload = async (event) => {
        if (global) {
            aria2SaveStorage(JSON.parse(reader.result));
            return aria2OptionsSetUp();
        }
        var conf = {};
        reader.result.split('\n').forEach((entry) => {
            var [key, value] = entry.split('=');
            conf[key] = value;
        });
        chrome.runtime.sendMessage({action: 'jsonrpc_onchange', params: {jsonrpc: conf}});
        aria2Global = jsonrpc.disposition(conf);
        updated = {...aria2Global};
    };
    reader.readAsText(file);
}

function addMatchRule(list, id, entry) {
    var old_value = updated[id];
    var new_value = [...old_value];
    var add = [];
    entry.value.match(/[^\s;,"'`]+/g)?.forEach((value) => {
        if (value && !new_value.includes(value)) {
            var rule = createMatchRule(list, value, true);
            add.push({list, value, index: new_value.length, rule});
            new_value.push(value);
        }
    });
    entry.value = '';
    undoes.push({id, old_value, new_value, add});
    optionsCheckUndone(id, new_value);
}

function removeMatchRule(list, id, value) {
    var old_value = updated[id]
    var new_value = [...old_value];
    var index = new_value.indexOf(value);
    var rule = list[value];
    new_value.splice(index, 1);
    rule.remove();
    undoes.push({id, old_value, new_value, remove: [{list, value, index, rule}]});
    optionsCheckUndone(id, new_value);
}

function createMatchRule(list, value, roll) {
    var rule = ruleLET.cloneNode(true);
    var [div, btn] = rule.querySelectorAll('div, button');
    rule.title = div.textContent = btn.dataset.mid = value;
    list[value] = rule;
    list.append(rule);
    if (roll) {
        list.scrollTop = list.scrollHeight;
    }
    return rule;
}

function undoMatchRule({add, remove}) {
    if (remove) {
        return remove.forEach(({list, value, index, rule}) => list.insertBefore(rule, list.children[index]));
    }
    add.forEach(({list, value, index, rule}) => rule.remove());
}

function redoMatchRule({add, remove}) {
    if (remove) {
        return remove.forEach(({list, value, index, rule}) => rule.remove());
    }
    add.forEach(({list, value, index, rule}) => list.insertBefore(rule, list.children[index]));
}

function aria2OptionsSetUp() {
    updated = {...aria2Storage};
    aria2ver.textContent = version;
    options.forEach((entry) => {
        var eid = entry.dataset.eid;
        var value = updated[eid];
        if (eid in switches) {
            entry.checked = value;
            if (switches[eid]) {
                value ? extension.add(eid) : extension.remove(eid);
            }
            return;
        }
        entry.value = value;
    });
    matches.forEach((menu) => {
        var id = menu.dataset.map;
        var list = records[id];
        list.innerHTML = '';
        updated[id].forEach((rule) => createMatchRule(list, rule));
    });
}

function aria2SaveStorage(json) {
    json['manager_interval'] = json['manager_interval'] | 0;
    json['capture_size_include'] = json['capture_size_include'] | 0;
    json['capture_size_exclude'] = json['capture_size_exclude'] | 0;
    chrome.runtime.sendMessage({action: 'options_onchange', params: {storage: json, changes}});
    aria2Storage = json;
    changes = {};
}

chrome.runtime.sendMessage({action: 'options_plugins'}, ({storage, jsonrpc, version}) => {
    aria2Storage = storage;
    aria2Conf = {'enable-rpc': true, ...jsonrpc};
    aria2Version = version;
    aria2OptionsSetUp();
});
