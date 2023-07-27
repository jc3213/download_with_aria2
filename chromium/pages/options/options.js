var [saveBtn, undoBtn, redoBtn] = document.querySelectorAll('#menu > button');
var [aria2ver, aria2ua] = document.querySelectorAll('#version, #aria2ua');
var [importJson, importConf, exporter] = document.querySelectorAll('#menu > input, #menu > a');
var options = document.querySelectorAll('[data-eid]');
var jsonrpc = document.querySelectorAll('[data-rid]');
var appver = chrome.runtime.getManifest().version;
var changes = {};
var redoes = [];
var undoes = [];
var undone = false;
var global = true;
var entries = {};
options.forEach((entry) => entries[entry.dataset.eid] = entry);
var multiply = {
    'manager_interval': 1000,
    'capture_filesize': 1048576
};
var switches = {
    'manager_newtab': true,
    'notify_start': true,
    'notify_complete': true,
    'download_headers': true,
    'download_prompt': true,
    'folder_enabled': true,
    'proxy_enabled': true,
    'proxy_always': true,
    'capture_enabled': true,
    'capture_always': true
};
var rulelist = document.querySelectorAll('[data-map]');
var listed = {};
var listLET = document.querySelector('.template > .rule');
var binded = {
    'proxy_always': [
        {id: 'proxy_enabled', rel: true}
    ],
    'proxy_include': [
        {id: 'proxy_enabled', rel: true},
        {id: 'proxy_always', rel: false}
    ],
    'capture_always': [
        {id: 'capture_enabled', rel: true}
    ],
    'capture_filesize': [
        {id: 'capture_enabled', rel: true},
        {id: 'capture_always', rel: false}
    ]
}
binded['capture_exclude'] = binded['capture_reject'] = binded['capture_always'];
binded['capture_include'] = binded['capture_resolve'] = binded['capture_filesize'];
var related = {
    'folder_enabled': [],
    'proxy_enabled': [],
    'proxy_always': [],
    'capture_enabled': [],
    'capture_always': []
};

document.addEventListener('keydown', (event) => {
    var {ctrlKey, key} = event;
    if (ctrlKey) {
        if (key === 's') {
            event.preventDefault();
            saveBtn.click();
        }
        else if (key === 'z') {
            event.preventDefault();
            undoBtn.click();
        }
        else if (key === 'y') {
            event.preventDefault();
            redoBtn.click();
        }
    }
});

document.addEventListener('click', ({target}) => {
    var id = target.dataset.bid;
    if (id === 'save_btn') {
        optionsSave();
    }
    else if (id === 'undo_btn') {
        optionsUndo();
    }
    else if (id === 'redo_btn') {
        optionsRedo();
    }
    else if (id === 'export_btn') {
        optionsExport();
    }
    else if (id === 'import_btn') {
        optionsImport();
    }
    else if (id === 'aria2_btn') {
        optionsJsonrpc();
    }
    else if (id === 'back_btn') {
        optionsExtension();
    }
});

function optionsSave() {
    if (global) {
        aria2Store = {...changes};
        chrome.storage.local.set(changes);
    }
    else {
        aria2RPC.call('aria2.changeGlobalOption', changes);
    }
    saveBtn.disabled = true;
}

function optionsUndo() {
    var undo = undoes.pop();
    var {id, old_value} = undo;
    redoes.push(undo);
    redoBtn.disabled = false;
    undone = true;
    console.log(id, old_value);
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
        var output = [JSON.stringify(aria2Store, null, 4)];
        var name = `downwitharia2_options-${time}.json`;
    }
    else {
        output = Object.keys(aria2Conf).map((key) => `${key}=${aria2Conf[key]}\n`);
        name = `aria2c_jsonrpc-${time}.conf`;
    }
    var blob = new Blob(output, {type: 'application/json; charset=utf-8'});
    exporter.href = URL.createObjectURL(blob);
    exporter.download = name;
    exporter.click();
}

function optionsImport() {
    global ? importJson.click() : importConf.click();
}

async function optionsJsonrpc() {
    var [options, version] = await aria2RPC.batch([
        ['aria2.getGlobalOption'], ['aria2.getVersion']
    ]);
    clearChanges();
    global = false;
    aria2Global = jsonrpc.disposition(options);
    aria2Conf = {'enable-rpc': true, ...options};
    changes = {...aria2Global};
    aria2ver.textContent = aria2ua.textContent = version.version;
    document.body.className = 'aria2';
}

function optionsExtension() {
    clearChanges();
    global = true;
    aria2StartUp();
    document.body.className = 'local';
}

document.addEventListener('change', ({target}) => {
    var {dataset: {eid, rid}, value, checked, files} = target;
    if (eid) {
        setChange(eid, eid in switches ? checked : eid in multiply ? value * multiply[eid] : value);
    }
    else if (rid) {
        setChange(rid, value);
    }
    else if (files) {
        optionsImport(files[0]);
        target.value = '';
    }
});

function optionsImport(file) {
    clearChanges();
    var reader = new FileReader();
    reader.onload = async (event) => {
        if (global) {
            var json = JSON.parse(reader.result);
            chrome.storage.local.set(json);
            aria2Store = json;
            aria2StartUp();
        }
        else {
            var conf = {};
            reader.result.split('').forEach((entry) => {
                var [key, value] = entry.split('=');
                conf[key] = value;
            });
            await aria2RPC.call('aria2.changeGlobalOption', conf);
            aria2Global = jsonrpc.disposition(conf);
            changes = {...aria2Global};
        }
    };
    reader.readAsText(file);
}

rulelist.forEach(menu => {
    var id = menu.dataset.map;
    var [entry, addBtn, list] = menu.querySelectorAll('input, button, .rulelist');
    entry.addEventListener('keydown', ({key}) => {
        if (key === 'Enter') {
            addBtn.click();
        }
    });
    addBtn.addEventListener('click', (event) => {
        var {value} = entry;
        var old_value = changes[id];
        if (value !== '' && !old_value.includes(value)) {
            var new_value = [...old_value, value];
            setChange(id, new_value);
            entry.value = '';
            printList(list, old_value.length, value);
        }
    });
    list.addEventListener('click', ({target}) => {
        var mid = target.dataset.mid;
        if (mid) {
            var new_value = [...changes[id]];
            new_value.splice(mid, 1);
            setChange(id, new_value);
            target.parentNode.remove();
        }
        
    });
    listed[id] = list;
    menu.list = {id, list};
});

document.querySelectorAll('[data-rel]').forEach((menu) => {
    var id = menu.dataset.rel;
    var bind = binded[id];
    var match = bind.length;
    bind.forEach(({id}) => related[id]?.push(menu));
    menu.rel = {bind, match};
});

function optionsRelated(menu) {
    var {bind, match} = menu.rel;
    var count = 0;
    bind.forEach(({id, rel}) => {
        if (rel === changes[id]) {
            count ++;
        }
    });
    menu.style.display = count === match ? '' : 'none';
}

chrome.storage.onChanged.addListener((changes) => {
    if ('jsonrpc_uri' in changes || 'jsonrpc_token' in changes) {
        aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['jsonrpc_token']);
    }
});

chrome.storage.local.get(null, (json) => {
    aria2Store = json;
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['jsonrpc_token']);
    aria2StartUp();
});

function aria2StartUp() {
    changes = {...aria2Store};
    aria2ver.textContent = appver;
    options.forEach((entry) => {
        var eid = entry.dataset.eid;
        var value = changes[eid];
        if (eid in switches) {
            entry.checked = value;
            related[eid]?.forEach(optionsRelated);
        }
        else {
            entry.value = eid in multiply ? value / multiply[eid] : value;
        }
    });
    rulelist.forEach((menu) => {
        var {id, list} = menu.list;
        list.innerHTML = '';
        changes[id].forEach((value, mid) => printList(list, mid, value));
    });
}

function clearChanges() {
    undoes = [];
    redoes = [];
    saveBtn.disabled = undoBtn.disabled = redoBtn.disabled = true;
}

function getChange(id, value) {
    changes[id] = value;
    saveBtn.disabled = false;
    var entry = entries[id];
    console.log(entry, id, value);
    if (id in listed) {
        getList(id, value);
    }
    else if (id in switches) {
        entry.checked = value;
        related[id]?.forEach(optionsRelated);
    }
    else {
        entry.value = id in multiply ? value / multiply[id] : value;
    }
}

function setChange(id, new_value) {
    var old_value = changes[id];
    undoes.push({id, old_value, new_value});
    saveBtn.disabled = undoBtn.disabled = false;
    changes[id] = new_value;
    related[id]?.forEach(optionsRelated);
    if (undone) {
        redoes = [];
        undone = false;
        redoBtn.disabled = true;
    }
}

function getList(id, value) {
    var list = listed[id];
    list.innerHTML = '';
    value.forEach((val, mid) => printList(list, mid, val));
}

function printList(list, mid, value) {
    var item = listLET.cloneNode(true);
    item.querySelector('span').textContent = value;
    item.querySelector('button').dataset.mid = mid;
    list.append(item);
}
