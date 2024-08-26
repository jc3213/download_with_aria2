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
var [saveBtn, undoBtn, redoBtn, aria2ver, exporter, aria2ua] = document.querySelectorAll('#menu > :nth-child(-n+4), a, #aria2ua');
var options = document.querySelectorAll('[data-eid]');
var jsonrpc = document.querySelectorAll('[data-rid]');
var mapping = document.querySelectorAll('[data-map]');
var ruleLET = document.querySelector('.template > div');
var matches = {
    'capture_exclude': true,
    'capture_include': true,
    'capture_type_exclude': true,
    'capture_type_include': true,
    'headers_exclude': true,
    'proxy_include': true
};
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
    var {add, entry, id, old_value, remove, resort} = undo;
    updated[id] = changes[id] = old_value;
    matches[id] ? resort ? undoResort(resort) : undoMatchRule(add, remove) : id in switches ? optionsCheckbox(entry, id, old_value) : optionsEntryValue(entry, old_value);
    saveBtn.disabled = redoBtn.disabled = false;
    undone = true;
    if (undoes.length === 0) {
        undoBtn.disabled = true;
    }
}

function optionsRedo() {
    var redo = redoes.pop();
    undoes.push(redo);
    var {add, entry, id, new_value, remove, resort} = redo;
    updated[id] = changes[id] = new_value;
    matches[id] ? resort ? redoResort(resort) : redoMatchRule(add, remove) : id in switches ? optionsCheckbox(entry, id, new_value) :optionsEntryValue(entry, new_value);
    saveBtn.disabled = undoBtn.disabled = false;
    if (redoes.length === 0) {
        redoBtn.disabled = true;
    }
}

function optionsCheckbox(entry, id, value, startup) {
    entry.checked = value;
    if (switches[id]) {
        startup ? value ? extension.add(id) : extension.remove(id) : extension.toggle(id);
    }
}

function optionsEntryValue(entry, value) {
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
    aria2OptionsSetup();
    extension.remove('jsonrpc');
}

function optionEmptyChanges() {
    undoes = [];
    redoes = [];
    saveBtn.disabled = undoBtn.disabled = redoBtn.disabled = true;
}

document.getElementById('menu').addEventListener('change', (event) => {
    var reader = new FileReader();
    reader.onload = (event) => {
        if (global) {
            aria2SaveStorage(JSON.parse(reader.result));
            return aria2OptionsSetup();
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
    reader.readAsText(event.target.files[0]);
    optionEmptyChanges();
    event.target.value = '';
});

document.getElementById('options').addEventListener('change', (event) => {
    var id = event.target.dataset.eid;
    if (id) {
        optionsChanges(event.target, id, id in switches ? event.target.checked : event.target.value);
    }
});

document.getElementById('jsonrpc').addEventListener('change', (event) => {
    optionsChanges(event.target, event.target.dataset.rid, event.target.value);
});

function optionsChanges(entry, id, new_value) {
    undoes.push({entry, id, new_value, old_value: updated[id]});
    if (switches[id]) {
        extension.toggle(id);
    }
    optionsChangeApply(id, new_value);
}

function optionsChangeApply(id, new_value) {
    updated[id] = changes[id] = new_value;
    saveBtn.disabled = undoBtn.disabled = false;
    if (undone) {
        redoes = [];
        undone = false;
        redoBtn.disabled = true;
    }
}

mapping.forEach((match) => {
    var id = match.id;
    var [entry, list] = match.querySelectorAll('input, .list');
    match.list = list;
    match.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            addMatchPattern(list, id, entry);
        }
    });
    match.addEventListener('click', (event) => {
        switch (event.target.dataset.bid) {
            case 'add_rule':
                addMatchPattern(list, id, entry);
                break;
            case 'resort_rule':
                resortMatchPattern(list, id);
                break;
            case 'remove_rule':
                removeMatchPattern(list, id, event.target.parentNode);
                break;
        }
    });
});

function addMatchPattern(list, id, entry) {
    var old_value = updated[id];
    var new_value = [...old_value];
    var add = [];
    entry.value.match(/[^\s\r\n+=,;"'`\\|/?!@#$%^&()\[\]{}<>]+/g)?.forEach((value) => {
        if (value && !new_value.includes(value)) {
            var rule = createMatchRule(list, value);
            add.push({list, index: new_value.length, rule});
            new_value.push(value);
            list.scrollTop = list.scrollHeight;
        }
    });
    entry.value = '';
    undoes.push({add, id, new_value, old_value});
    optionsChangeApply(id, new_value);
}

function resortMatchPattern(list, id) {
    var old_value = updated[id];
    var new_value = [...old_value].sort();
    var old_order = [...list.children];
    var new_order = [...old_order].sort((a, b) => a.textContent.localeCompare(b.textContent));
    list.append(...new_order);
    undoes.push({id, old_value, new_value, resort: {list, new_order, old_order}});
    optionsChangeApply(id, new_value);
}

function removeMatchPattern(list, id, rule) {
    var old_value = updated[id]
    var new_value = [...old_value];
    var index = new_value.indexOf(rule.title);
    new_value.splice(index, 1);
    rule.remove();
    undoes.push({id, new_value, old_value, remove: [{list, index, rule}]});
    optionsChangeApply(id, new_value);
}

function createMatchRule(list, value) {
    var rule = ruleLET.cloneNode(true);
    rule.querySelector('div').textContent = rule.title = value;
    list.appendChild(rule);
    return rule;
}

function undoResort({list, old_order}) {
    list.append(...old_order);
}

function redoResort({list, new_order}) {
    list.append(...new_order);
}

function undoMatchRule(add, remove) {
    add ? add.forEach(({rule}) => rule.remove()) : remove.forEach(({list, index, rule}) => list.insertBefore(rule, list.children[index]));
}

function redoMatchRule(add, remove) {
    add ? add.forEach(({list, index, rule}) => list.insertBefore(rule, list.children[index])) : remove.forEach(({rule}) => rule.remove());
}

function aria2OptionsSetup() {
    updated = {...aria2Storage};
    aria2ver.textContent = version;
    options.forEach((entry) => {
        var id = entry.dataset.eid;
        var value = updated[id];
        id in switches ? optionsCheckbox(entry, id, value, true) : optionsEntryValue(entry, value);
    });
    mapping.forEach(({id, list}) => {
        list.innerHTML = '';
        updated[id].forEach((value) => createMatchRule(list, value));
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
    aria2OptionsSetup();
});
