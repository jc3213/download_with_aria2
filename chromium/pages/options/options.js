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
var ruleLet = document.querySelector('.template > .rule');
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
    'capture_always': true,
    'capture_webrequest': true
};

options.forEach((entry) => {
    entries[entry.dataset.eid] = entry;
});

matches.forEach(menu => {
    var id = menu.dataset.map;
    var [entry, list] = menu.querySelectorAll('input, .list');
    menu.addEventListener('keydown', ({key}) => {
        if (key === 'Enter') {
            addRule(list, id, entry);
        }
    });
    menu.addEventListener('click', (event) => {
        switch (event.target.dataset.bid) {
            case 'add_rule':
                addRule(list, id, entry);
                break;
            case 'remove_rule':
                removeRule(list, id, event.target.dataset.mid);
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
    var {id, old_value} = undo;
    redoes.push(undo);
    redoBtn.disabled = false;
    undone = true;
    optionSetValue(id, old_value);
    if (undoes.length === 0) {
        undoBtn.disabled = true;
    }
}

function optionsRedo() {
    var redo = redoes.pop();
    var {id, new_value} = redo;
    undoes.push(redo);
    undoBtn.disabled = false;
    optionSetValue(id, new_value);
    if (redoes.length === 0) {
        redoBtn.disabled = true;
    }
}

function optionSetValue(id, value) {
    updated[id] = changes[id] = value;
    saveBtn.disabled = false;
    var entry = entries[id];
    if (records[id]) {
        return updateRule(id, value);
    }
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

document.addEventListener('change', ({target}) => {
    var {dataset: {eid, rid}, value, checked, files} = target;
    if (eid) {
        return optionChange(eid, eid in switches ? checked : value);
    }
    if (rid) {
        return optionChange(rid, value);
    }
    if (files) {
        optionsImport(files[0]);
        target.value = '';
    }
});

function optionChange(id, new_value) {
    var old_value = updated[id];
    undoes.push({id, old_value, new_value});
    saveBtn.disabled = undoBtn.disabled = false;
    updated[id] = changes[id] = new_value;
    if (switches[id]) {
        extension.toggle(id);
    }
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

function addRule(list, id, entry) {
    var new_value = [...updated[id]];
    var add_value = entry.value.match(/[^\s;,"'`]+/g);
    entry.value = '';
    if (add_value) {
        add_value.forEach((value) => {
            if (value && !new_value.includes(value)) {
                new_value.push(value);
                printRule(list, value, true);
            }
        });
        optionChange(id, new_value);
    }
}

function removeRule(list, id, rule) {
    var new_value = [...updated[id]];
    new_value.splice(new_value.indexOf(rule), 1);
    optionChange(id, new_value);
    list[rule].remove();
}

function printRule(list, rule, roll) {
    var item = ruleLet.cloneNode(true);
    var [div, btn] = item.querySelectorAll('div, button');
    item.title = div.textContent = btn.dataset.mid = rule;
    list[rule] = item;
    list.append(item);
    if (roll) {
        list.scrollTop = list.scrollHeight;
    }
}

function updateRule(id, rules) {
    var list = records[id];
    list.innerHTML = '';
    rules.forEach((rule) => printRule(list, rule));
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
        updateRule(id, updated[id]);
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
