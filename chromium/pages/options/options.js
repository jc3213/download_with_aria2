var savebtn = document.querySelector('#save_btn');
var undobtn = document.querySelector('#undo_btn');
var redobtn = document.querySelector('#redo_btn');
var appver = chrome.runtime.getManifest().version;
var aria2ver = document.querySelector('#version');
var aria2ua = document.querySelector('#aria2ua');
var aria2options = document.querySelectorAll('#aria2 input, #aria2 select');
var [importJson, importConf, exporter] = document.querySelectorAll('#menu > input, #menu > a');
var changes = {};
var redoes = [];
var undoes = [];
var undone = false;
var global = true;
var textarea = document.querySelectorAll('#local input[id]:not([type="checkbox"])');
var multiply = {
    'manager_interval': 1000,
    'capture_filesize': 1048576
};
var checkbox = document.querySelectorAll('#local [type="checkbox"]');
var checked = {};
var rulelist = document.querySelectorAll('[data-list]');
var listed = {};
var listLET = document.querySelector('.template > .rule');
var linkage = {
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
            savebtn.click();
        }
        else if (key === 'z') {
            event.preventDefault();
            undobtn.click();
        }
        else if (key === 'y') {
            event.preventDefault();
            redobtn.click();
        }
    }
});

document.querySelector('#menu').addEventListener('click', ({target}) => {
    var {id} = target;
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
});

function optionsSave() {
    if (global) {
        aria2Store = {...changes};
        chrome.storage.local.set(changes);
    }
    else {
        aria2RPC.call('aria2.changeGlobalOption', changes);
    }
    savebtn.disabled = true;
}

function optionsUndo() {
    var undo = undoes.pop();
    var {id, old_value} = undo;
    redoes.push(undo);
    redobtn.disabled = false;
    undone = true;
    getChange(id, old_value);
    if (undoes.length === 0) {
        undobtn.disabled = true;
    }
}

function optionsRedo() {
    var redo = redoes.pop();
    var {id, new_value} = redo;
    undoes.push(redo);
    undobtn.disabled = false;
    getChange(id, new_value);
    if (redoes.length === 0) {
        redobtn.disabled = true;
    }
}

function optionsExport() {
    var time = new Date().toLocaleString('ja').replace(/[\/\s:]/g, '_');
    if (global) {
        var output = [JSON.stringify(aria2Store, null, 4)];
        var name = `downwitharia2_options-${time}.json`;
    }
    else {
        output = Object.keys(aria2CONF).map((key) => `${key}=${aria2CONF[key]}\n`);
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

document.querySelector('#menu').addEventListener('change', async ({target}) => {
    clearChanges();
    var text = await getFileText(target.files[0]);
    if (global) {
        var json = JSON.parse(text);
        chrome.storage.local.set(json);
        aria2Store = json;
        aria2StartUp();
    }
    else {
        var conf = {};
        text.split('\n').forEach((entry) => {
            var [key, value] = entry.split('=');
            conf[key] = value;
        });
        await aria2RPC.call('aria2.changeGlobalOption', conf);
        aria2Global = aria2options.disposition(conf);
        changes = {...aria2Global};
    }
    target.value = '';
});

function getFileText(file) {
    return new Promise((resolve, reject) => {
        var reader = new FileReader();
        reader.onload = (event) => resolve(reader.result);
        reader.onerror = (event) => reject(reader.error);
        reader.readAsText(file);
    });
}

document.querySelector('#back_btn').addEventListener('click', (event) => {
    clearChanges();
    global = true;
    aria2StartUp();
    document.body.className = 'local';
});

document.querySelector('#aria2_btn').addEventListener('click', async (event) => {
    var [options, version] = await aria2RPC.batch([
        ['aria2.getGlobalOption'], ['aria2.getVersion']
    ]);
    clearChanges();
    global = false;
    aria2Global = aria2options.disposition(options);
    aria2CONF = {'enable-rpc': true, ...options};
    changes = {...aria2Global};
    aria2ver.textContent = aria2ua.textContent = version.version;
    document.body.className = 'aria2';
});

textarea.forEach(entry => {
    var {id} = entry;
    entry.addEventListener('change', (event) => {
        var value = getValue(id, entry.value);
        setChange(id, value);
    });
});

checkbox.forEach(entry => {
    var {id} = entry;
    entry.addEventListener('change', (event) => {
        setChange(id, entry.checked);
    });
    checked[id] = true;
});

rulelist.forEach(menu => {
    var id = menu.getAttribute('data-list');
    var entry = menu.querySelector('input');
    var addbtn = menu.querySelector('button');
    var list = menu.querySelector('.rulelist');
    entry.addEventListener('keydown', ({key}) => {
        if (key === 'Enter') {
            addbtn.click();
        }
    });
    addbtn.addEventListener('click', (event) => {
        var {value} = entry;
        if (value !== '') {
            var new_value = [...changes[id], value];
            setChange(id, new_value);
            entry.value = '';
            printList(list, value);
        }
    });
    list.addEventListener('click', ({target}) => {
        var {rule} = target;
        if (rule) {
            var new_value = [...changes[id]];
            new_value.splice(new_value.indexOf(rule), 1);
            setChange(id, new_value);
            target.parentNode.remove();
        }
        
    });
    listed[id] = list;
    menu.list = {id, list};
});

document.querySelectorAll('[data-link]').forEach((menu) => {
    var data = menu.getAttribute('data-link').match(/[^,;]+/g);
    var [id, value] = data.splice(0, 2);
    linkage[id].push(menu);
    var minor = [];
    var rule = value === '1' ? true : false;
    data.forEach((id, idx) => {
       if (isNaN(id)) {
            var value = data[idx + 1];
            var rule = value === '1' ? true : false;
            linkage[id].push(menu);
            minor.push({id, rule});
        }
    });
    menu.link = {major: {id, rule}, minor};
});

document.querySelector('#aria2').addEventListener('change', (event) => {
    var {id, value} = event.target;
    setChange(id, value);
});

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
    textarea.forEach((entry) => {
        var {id} = entry;
        var value = changes[id];
        entry.value = setValue(id, value);
    });
    checkbox.forEach((entry) => {
        var {id} = entry;
        entry.checked = changes[id];
        linkage[id]?.forEach(printLinkage);
    });
    rulelist.forEach((menu) => {
        var {id, list} = menu.list;
        list.innerHTML = '';
        changes[id].forEach((value) => printList(list, value));
    });
}

function printLinkage(menu) {
    var {major, minor} = menu.link;
    var {id, rule} = major;
    var prime = rule === changes[id];
    var second = 0;
    minor.forEach(({id, rule}) => {
        var value = changes[id];
        if (rule === value) {
            second ++;
        }
    });
    if (prime) {
        menu.style.display = second === minor.length ? '' : 'none';
    }
    else {
        menu.style.display = 'none';
    }
}

function clearChanges() {
    undoes = [];
    redoes = [];
    savebtn.disabled = undobtn.disabled = redobtn.disabled = true;
}

function getChange(id, value) {
    changes[id] = value;
    savebtn.disabled = false;
    var entry = document.getElementById(id);
    if (id in listed) {
        getList(id, value);
    }
    else if (id in checked) {
        entry.checked = value;
    }
    else {
        entry.value = setValue(id, value);
    }
    linkage[id]?.forEach(printLinkage);
}

function setChange(id, new_value) {
    var old_value = changes[id];
    undoes.push({id, old_value, new_value});
    savebtn.disabled = undobtn.disabled = false;
    changes[id] = new_value;
    linkage[id]?.forEach(printLinkage);
    if (undone) {
        redoes = [];
        undone = false;
        redobtn.disabled = true;
    }
}

function getValue(id, value) {
    if (id in multiply) {
        return value * multiply[id];
    }
    return value;
}

function setValue(id, value) {
    if (id in multiply) {
        return value / multiply[id];
    }
    return value;
}

function getList(id, value) {
    var list = listed[id];
    list.innerHTML = '';
    value.forEach((val) => printList(list, val));
}

function printList(list, value) {
    var item = listLET.cloneNode(true);
    item.querySelector('span').textContent = item.querySelector('button').rule = value;
    list.append(item);
}
