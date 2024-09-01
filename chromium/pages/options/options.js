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
var [saveBtn, undoBtn, redoBtn, storageExp, jsonrpcExp] = document.querySelectorAll('#menu > button')
var [aria2ver, exporter, aria2ua] = document.querySelectorAll('#version, a, #useragent');
var options = document.querySelectorAll('[data-eid]');
var jsonrpc = document.querySelectorAll('#jsonrpc input');
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

saveBtn.addEventListener('click', (event) => {
    saveBtn.disabled = true;
    global ? aria2SaveStorage(updated) : chrome.runtime.sendMessage({action: 'jsonrpc_onchange', params: {jsonrpc: changes}});
});

undoBtn.addEventListener('click', (event) => {
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
});

redoBtn.addEventListener('click', (event) => {
    var redo = redoes.pop();
    undoes.push(redo);
    var {add, entry, id, new_value, remove, resort} = redo;
    updated[id] = changes[id] = new_value;
    matches[id] ? resort ? redoResort(resort) : redoMatchRule(add, remove) : id in switches ? optionsCheckbox(entry, id, new_value) :optionsEntryValue(entry, new_value);
    saveBtn.disabled = undoBtn.disabled = false;
    if (redoes.length === 0) {
        redoBtn.disabled = true;
    }
});

storageExp.addEventListener('click', (event) => {
    var body = [JSON.stringify(aria2Storage, null, 4)];
    fileSaver(body, 'downwitharia2', 'json');
});

jsonrpcExp.addEventListener('click', (event) => {
    var body = Object.keys(aria2Conf).map((key) => key + '=' + aria2Conf[key] + '\n');
    fileSaver(body, 'aria2_jsonrpc', 'conf');
});

function fileSaver(body, name, type) {
    var time = new Date().toLocaleString('ja').replace(/[\/\s:]/g, '_');
    var blob = new Blob(body);
    exporter.href = URL.createObjectURL(blob);
    exporter.download = name + '-' + time + '.' + type;
    exporter.click();
}

document.getElementById('storage').addEventListener('change', async (event) => {
    var file = await fileReader(event.target.files[0]);
    changes = JSON.parse(file);
    aria2SaveStorage(changes);
    aria2OptionsSetup();
    optionEmptyChanges();
    event.target.value = '';
});

document.getElementById('config').addEventListener('change', async (event) => {
    var file = await fileReader(event.target.files[0]);
    var conf = {};
    file.split('\n').forEach((line) => {
        if (line[0] !== '#') {
            var [key, value] = line.split('=');
            conf[key] = value;
        }
    });
    chrome.runtime.sendMessage({action: 'jsonrpc_onchange', params: {jsonrpc: conf}});
    aria2Global = jsonrpc.disposition(conf);
    updated = {...aria2Global};
    optionEmptyChanges();
    event.target.value = '';
});

function fileReader(file) {
    return new Promise((resolve) => {
        var reader = new FileReader();
        reader.onload = (event) => resolve(reader.result);
        reader.readAsText(file);
    });
}

function optionEmptyChanges() {
    undoes = [];
    redoes = [];
    saveBtn.disabled = undoBtn.disabled = redoBtn.disabled = true;
}

document.getElementById('goto-jsonrpc').addEventListener('click', (event) => {
    if (!aria2Version) {
        return;
    }
    optionEmptyChanges();
    global = false;
    aria2Global = jsonrpc.disposition(aria2Conf);
    updated = {...aria2Global};
    aria2ver.textContent = aria2ua.textContent = aria2Version;
    extension.add('jsonrpc');
});

document.getElementById('goto-options').addEventListener('click', (event) => {
    optionEmptyChanges();
    global = true;
    aria2OptionsSetup();
    extension.remove('jsonrpc');
});

document.getElementById('options').addEventListener('change', (event) => {
    var id = event.target.dataset.eid;
    if (id) {
        optionsChanged(event.target, id, id in switches ? event.target.checked : event.target.value);
    }
});

document.getElementById('jsonrpc').addEventListener('change', (event) => {
    optionsChanged(event.target, event.target.name, event.target.value);
});

function optionsCheckbox(entry, id, value, startup) {
    entry.checked = value;
    if (switches[id]) {
        startup ? value ? extension.add(id) : extension.remove(id) : extension.toggle(id);
    }
}

function optionsEntryValue(entry, value) {
    entry.value = value;
}

function optionsChanged(entry, id, new_value) {
    if (switches[id]) {
        extension.toggle(id);
    }
    optionsChangeApply(id, new_value, {entry, id, new_value, old_value: updated[id]});
}

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

mapping.forEach((match) => {
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

function addMatchPattern(list, id, entry) {
    var old_value = updated[id];
    var new_value = [...old_value];
    var add = [];
    entry.value.match(/[^\s\r\n+=,;"'`\\|/?!@#$%^&()\[\]{}<>]+/g)?.forEach((value) => {
        if (value && !new_value.includes(value)) {
            var rule = createMatchRule(list, id, value);
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

function createMatchRule(list, id, value) {
    var rule = ruleLET.cloneNode(true);
    var [content, purge] = rule.querySelectorAll('*');
    content.textContent = rule.title = value;
    purge.addEventListener('click', (event) => removeMatchPattern(list, id, event.target.parentNode));
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
        updated[id].forEach((value) => createMatchRule(list, id, value));
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
