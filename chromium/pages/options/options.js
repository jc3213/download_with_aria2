var aria2Storage = {};
var aria2Config = {};
var aria2Version;

var updated = {};
var undoes = [];
var undone = false;
var redoes = [];

var extension = document.body.classList;
var [saveBtn, undoBtn, redoBtn, tellVer, exportBtn, importBtn, jsonFile, confFile, exporter] = document.querySelectorAll('#menu > *')
var [jsonrpcBtn, optionsBtn, tellUA] = document.querySelectorAll('#goto-jsonrpc, #goto-options, #useragent');
var optionsEntries = document.querySelectorAll('#options [name]:not([type="checkbox"])');
var optionsCheckboxes = document.querySelectorAll('[type="checkbox"]');
var optionsMatches = document.querySelectorAll('.matches div[id]');
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
    var undo = undoes.pop();
    redoes.push(undo);
    optionsUndoRedo('undo', undo.old_value, undo);
    saveBtn.disabled = redoBtn.disabled = false;
    undone = true;
    if (undoes.length === 0) {
        undoBtn.disabled = true;
    }
});

redoBtn.addEventListener('click', (event) => {
    var redo = redoes.pop();
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
    optionsHistoryFlushed();
    var file = await promiseFileReader(event.target.files[0]);
    updated = JSON.parse(file);
    aria2StorageUpdate();
    aria2StorageSetup();
    event.target.value = '';
});

confFile.addEventListener('change', async (event) => {
    optionsHistoryFlushed();
    var file = await promiseFileReader(event.target.files[0]);
    var params = {};
    file.split('\n').forEach((line) => {
        if (line[0] !== '#') {
            var [key, value] = line.split('=');
            params[key] = value;
        }
    });
    chrome.runtime.sendMessage({action: 'jsonrpc_update', params});
    aria2ConfigSetup(params);
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
        var id = entry.name;
        var new_value = entry.value;
        optionsHistoryLogged({entry, id, new_value, old_value: updated[id]});
    });
});

optionsCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
        var id = checkbox.name;
        var new_value = checkbox.checked;
        if (checkbox.dataset.key) {
            extension.toggle(id);
        }
        optionsHistoryLogged({checkbox, id, new_value, old_value: !new_value});
    });
});

optionsMatches.forEach((match) => {
    var id = match.id;
    var [entry, addbtn, resort, list] = match.children;
    match.list = list;
    entry.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            addbtn.click();
        }
    });
    addbtn.addEventListener('click', (event) => {
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
        optionsHistoryLogged({add, id, new_value, old_value});
    });
    resort.addEventListener('click', (event) => {
        var old_value = updated[id];
        var new_value = [...old_value].sort();
        var old_order = [...list.children];
        var new_order = [...old_order].sort((a, b) => a.textContent.localeCompare(b.textContent));
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
    var rule = matchLET.cloneNode(true);
    var [content, purge] = rule.children;
    content.textContent = rule.title = value;
    purge.addEventListener('click', (event) => {
        var old_value = updated[id]
        var new_value = [...old_value];
        var index = new_value.indexOf(rule.title);
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
