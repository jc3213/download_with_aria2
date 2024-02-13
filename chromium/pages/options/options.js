var updated = {};
var changes = {};
var undoes = [];
var undone = false;
var redoes = [];
var global = true;
var extension = document.body;
var {version, manifest_version} = chrome.runtime.getManifest();
var [saveBtn, undoBtn, redoBtn, aria2ver, exportBtn, importBtn, importJson, importConf, exporter, aria2ua] = document.querySelectorAll('#menu > *, #aria2ua');
var options = document.querySelectorAll('[data-eid]');
var jsonrpc = document.querySelectorAll('[data-rid]');
var entries = {};
options.forEach((entry) => entries[entry.dataset.eid] = entry);
var multiply = {
    'manager_interval': 1000,
    'capture_filesize': 1048576
};
var switches = {
    'context_enabled': true,
    'context_cascade': false,
    'context_thisurl': false,
    'context_thisimage': false,
    'context_allimages': false,
    'manager_newtab': false,
    'notify_start': false,
    'notify_complete': false,
    'download_prompt': false,
    'headers_enabled': true,
    'folder_enabled': true,
    'folder_firefox': false,
    'proxy_enabled': true,
    'capture_enabled': true,
    'capture_webrequest': true,
    'capture_always': true
};
var mapped = document.querySelectorAll('[data-map]');
var listed = {};
var ruleLet = document.querySelector('.template > .rule');

if (typeof browser !== 'undefined') {
    extension.classList.add('firefox');
    var [folderff, captureen, captureff] = document.querySelectorAll('#folder_firefox, #capture_enabled, #capture_webrequest');
    folderff.parentNode.nextElementSibling.removeAttribute('class');
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
        case 'import_btn':
            optionsUpload();
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
    if (global) {
        return aria2SaveStorage(updated);
    }
    aria2RPC.call({method: 'aria2.changeGlobalOption', params: [updated]});
}

function optionsUndo() {
    var undo = undoes.pop();
    var {id, old_value} = undo;
    redoes.push(undo);
    redoBtn.disabled = false;
    undone = true;
    getChange(id, old_value);
    if (undoes.length === 0) {
        undoBtn.disabled = true;
    }
}

function optionsRedo() {
    var redo = redoes.pop();
    var {id, new_value} = redo;
    undoes.push(redo);
    undoBtn.disabled = false;
    getChange(id, new_value);
    if (redoes.length === 0) {
        redoBtn.disabled = true;
    }
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

function optionsUpload() {
    global ? importJson.click() : importConf.click();
}

async function optionsJsonrpc() {
    var [options, version] = await aria2RPC.call({method: 'aria2.getGlobalOption'}, {method: 'aria2.getVersion'});
    clearChanges();
    global = false;
    aria2Global = jsonrpc.disposition(options.result);
    aria2Conf = {'enable-rpc': true, ...options.result};
    updated = {...aria2Global};
    aria2ver.textContent = aria2ua.textContent = version.result.version;
    extension.classList.add('jsonrpc');
}

function optionsExtension() {
    clearChanges();
    global = true;
    aria2StartUp();
    extension.classList.remove('jsonrpc');
}

document.addEventListener('change', ({target}) => {
    var {dataset: {eid, rid}, value, checked, files} = target;
    if (eid) {
        return setChange(eid, eid in switches ? checked : eid in multiply ? value * multiply[eid] : value);
    }
    if (rid) {
        return setChange(rid, value);
    }
    if (files) {
        optionsImport(files[0]);
        target.value = '';
    }
});

function optionsImport(file) {
    clearChanges();
    var reader = new FileReader();
    reader.onload = async (event) => {
        if (global) {
            aria2SaveStorage(JSON.parse(reader.result));
            return aria2StartUp();
        }
        var conf = {};
        reader.result.split('\n').forEach((entry) => {
            var [key, value] = entry.split('=');
            conf[key] = value;
        });
        await aria2RPC.call({method: 'aria2.changeGlobalOption', params: [conf]});
        aria2Global = jsonrpc.disposition(conf);
        updated = {...aria2Global};
    };
    reader.readAsText(file);
}

mapped.forEach(menu => {
    var id = menu.dataset.map;
    var [entry, list] = menu.querySelectorAll('input, .list');
    menu.addEventListener('keydown', ({key}) => {
        if (key === 'Enter') {
            newRule(id, entry, list);
        }
    });
    menu.addEventListener('click', (event) => {
        switch (event.target.dataset.bid) {
            case 'add':
                newRule(id, entry, list);
                break;
            case 'remove':
                var new_value = [...updated[id]];
                new_value.splice(event.target.dataset.mid, 1);
                setChange(id, new_value);
                event.target.parentNode.remove();
                break;
        }
    });
    listed[id] = list;
});

function newRule(id, entry, list) {
    var {value} = entry;
    var old_value = updated[id];
    if (value !== '' && !old_value.includes(value)) {
        var new_value = [...old_value, value];
        setChange(id, new_value);
        entry.value = '';
        addRule(list, old_value.length, value, true);
    }
}

function addRule(list, mid, rule, roll) {
    var item = ruleLet.cloneNode(true);
    item.querySelector('div').textContent = item.title = rule;
    item.querySelector('button').dataset.mid = mid;
    list.append(item);
    if (roll) {
        list.scrollTop = list.scrollHeight;
    }
}

function updateRule(id, rules) {
    var list = listed[id];
    list.innerHTML = '';
    rules.forEach((rule, mid) => addRule(list, mid, rule));
}

chrome.storage.sync.get(null, (json) => {
    aria2Storage = json;
    aria2RPC = new Aria2(aria2Storage['jsonrpc_scheme'], aria2Storage['jsonrpc_host'], aria2Storage['jsonrpc_secret']);
    aria2StartUp();
});

function aria2StartUp() {
    updated = {...aria2Storage};
    aria2ver.textContent = version;
    options.forEach((entry) => {
        var eid = entry.dataset.eid;
        var value = updated[eid];
        if (eid in switches) {
            entry.checked = value;
            if (switches[eid]) {
                value ? extension.classList.add(eid) : extension.classList.remove(eid);
            }
            return;
        }
        entry.value = eid in multiply ? value / multiply[eid] : value;
    });
    mapped.forEach((menu) => {
        var id = menu.dataset.map;
        updateRule(id, updated[id]);
    });
}

function aria2SaveStorage(json) {
    chrome.runtime.sendMessage({action: 'options_onchange', params: {storage: json, changes}});
    aria2Storage = json;
    aria2WhenSaved();
    changes = {};
}

function aria2WhenSaved() {
    if ('jsonrpc_host' in changes) {
        aria2RPC.disconnect();
        aria2RPC = new Aria2(aria2Storage['jsonrpc_scheme'], aria2Storage['jsonrpc_host'], aria2Storage['jsonrpc_secret']);
        return;
    }
    if ('jsonrpc_scheme' in changes) {
        aria2RPC.method = aria2Storage['jsonrpc_scheme'];
    }
    if ('jsonrpc_secret' in changes) {
        aria2RPC.secret = 'token:' + aria2Storage['jsonrpc_secret'];
    }
}

function clearChanges() {
    undoes = [];
    redoes = [];
    saveBtn.disabled = undoBtn.disabled = redoBtn.disabled = true;
}

function getChange(id, value) {
    updated[id] = changes[id] = value;
    saveBtn.disabled = false;
    var entry = entries[id];
    if (id in listed) {
        return updateRule(id, value);
    }
    if (id in switches) {
        entry.checked = value;
        if (switches[eid]) {
            extension.classList.toggle(eid);
        }
        return;
    }
    entry.value = id in multiply ? value / multiply[id] : value;
}

function setChange(id, new_value) {
    var old_value = updated[id];
    undoes.push({id, old_value, new_value});
    saveBtn.disabled = undoBtn.disabled = false;
    updated[id] = changes[id] = new_value;
    if (switches[id]) {
        extension.classList.toggle(id);
    }
    if (undone) {
        redoes = [];
        undone = false;
        redoBtn.disabled = true;
    }
}
