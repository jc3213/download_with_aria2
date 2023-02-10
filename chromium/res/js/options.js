var savebtn = document.querySelector('#save_btn');
var undobtn = document.querySelector('#undo_btn');
var redobtn = document.querySelector('#redo_btn');
var importbtn = document.querySelector('#import_btn');
var exportbtn = document.querySelector('#export_btn');
var secret = document.querySelector('[name="jsonrpc_token"]');
var changes = {};
var undones = [];
var redones = [];
var global = true;
var mapping = {
    'proxy_include': 1,
    'capture_resolve': 1,
    'capture_reject': 1,
    'capture_include': 1,
    'capture_exclude': 1
};
var checking = {
    'manager_newtab': 1,
    'folder_enabled': 1,
    'download_headers': 1,
    'download_prompt': 1,
    'notify_start': 1,
    'notify_complete': 1,
    'proxy_enabled': 1,
    'proxy_always': 1,
    'capture_enabled': 1,
    'capture_always': 1
};
var offset = {
    'manager_interval': 1000,
    'capture_filesize': 1048576
};
var linkage = {
    'folder_enabled': [],
    'proxy_enabled': [],
    'proxy_always': [],
    'capture_enabled': [],
    'capture_always': []
};

document.addEventListener('keydown', event => {
    var {ctrlKey, keyCode} = event;
    if (ctrlKey) {
        if (keyCode === 83) {
            event.preventDefault();
            savebtn.click();
        }
        else if (keyCode === 90) {
            event.preventDefault();
            undobtn.click();
        }
        else if (keyCode === 89) {
            event.preventDefault();
            redobtn.click();
        }
    }
});

savebtn.addEventListener('click', event => {
    if (global) {
        aria2Store = {...changes};
        chrome.storage.local.set(changes);
    }
    else {
        aria2RPC.call('aria2.changeGlobalOption', [changes]);
    }
    savebtn.disabled = true;
});

undobtn.addEventListener('click', event => {
    var undo = redones.pop();
    var {name, old_value} = undo;
    undones.push(undo);
    redobtn.disabled = false;
    setChange(name, old_value);
    if (redones.length === 0) {
        undobtn.disabled = true;
    }
});

redobtn.addEventListener('click', event => {
    var redo = undones.pop();
    var {name, new_value} = redo;
    redones.push(redo);
    undobtn.disabled = false;
    setChange(name, new_value);
    if (undones.length === 0) {
        redobtn.disabled = true;
    }
});

document.querySelector('#version').innerText = chrome.runtime.getManifest().version;

document.querySelector('#back_btn').addEventListener('click', event => {
    clearChanges();
    global = true;
    aria2StartUp();
    document.body.className = 'local';
});

document.querySelector('#aria2_btn').addEventListener('click', async event => {
    var [options, version] = await aria2RPC.batch([
        {method: 'aria2.getGlobalOption'},
        {method: 'aria2.getVersion'}
    ]);
    clearChanges();
    global = false;
    aria2Global = document.querySelectorAll('#aria2 [name]').printOptions(options);
    document.querySelector('#aria2ver').innerText = version.version;
    document.body.className = 'aria2';
});

exportbtn.addEventListener('click', event => {
    var blob = new Blob([JSON.stringify(aria2Store)], {type: 'application/json; charset=utf-8'});
    var saver = document.createElement('a');
    saver.href = URL.createObjectURL(blob);
    saver.download = 'downwitharia2_options-' + new Date().toLocaleString('ja').replace(/[\/\s:]/g, '_') + '.json';
    saver.click();
});

importbtn.addEventListener('change', async event => {
    var json = await readFileTypeJSON(event.target.files[0]);
    chrome.storage.local.set(json);
    clearChanges();
    aria2Store = json;
    aria2StartUp();
    event.target.value = '';
});

document.querySelector('#show_btn').addEventListener('mousedown', event => {
    secret.type = 'text';
});

document.addEventListener('mouseup', event => {
    secret.type = 'password';
});

document.querySelector('#local').addEventListener('change', event => {
    var {name, value, checked} = event.target;
    var new_value = setValue(name, value, checked);
    var old_value = changes[name];
    getChange(name, old_value, new_value);
});

document.querySelector('#aria2').addEventListener('change', event => {
    var {name, value} = event.target;
    var old_value = changes[name];
    getChange(name, old_value, value);
});

document.querySelectorAll('[data-link]').forEach(menu => {
    var data = menu.getAttribute('data-link').match(/[^,;]+/g);
    var [name, value] = data.splice(0, 2);
    linkage[name].push(menu);
    var minor = [];
    var rule = value === '1' ? true : false;
    data.forEach((name, idx) => {
       if (isNaN(name)) {
            var value = data[idx + 1];
            var rule = value === '1' ? true : false;
            linkage[name].push(menu);
            minor.push({name, rule});
        }
    });
    menu.chain = {major: {name, rule}, minor};
});

chrome.storage.onChanged.addListener(changes => {
    if ('jsonrpc_uri' in changes || 'jsonrpc_token' in changes) {
        aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['jsonrpc_token']);
    }
});

function aria2StartUp() {
    changes = {...aria2Store};
    document.querySelectorAll('#local [name]').forEach(entry => {
        var {name} = entry;
        var value = aria2Store[name];
        if (name in checking) {
            entry.checked = value;
        }
        else {
            entry.value = getValue(name, value);
        }
        if (name in linkage) {
            linkage[name].forEach(printLinkage);
        }
    });
}

function printLinkage(menu) {
    var {major, minor} = menu.chain;
    var {name, rule} = major;
    var prime = rule === changes[name];
    var second = 0;
    minor.forEach(({name, rule}) => {
        var value = changes[name];
        if (rule === value) {
            second ++;
        }
    });
    if (prime) {
        menu.style.display = second === minor.length ? 'block' : 'none';
    }
    else {
        menu.style.display = 'none';
    }
}

function clearChanges() {
    changes = {};
    undones = [];
    redones = [];
    savebtn.disabled = undobtn.disabled = redobtn.disabled = true;
}

function setChange(name, value) {
    changes[name] = value;
    savebtn.disabled = false;
    var entry = document.querySelector('[name="' + name + '"]');
    if (name in checking) {
        entry.checked = value;
    }
    else {
        entry.value = getValue(name, value);
    }
    if (name in linkage) {
        linkage[name].forEach(printLinkage);
    }
}

function getChange(name, old_value, new_value) {
    redones.push({name, old_value, new_value});
    savebtn.disabled = undobtn.disabled = false;
    changes[name] = new_value;
    if (name in linkage) {
        linkage[name].forEach(printLinkage);
    }
}

function setValue(name, value, checked) {
    if (name in checking) {
        return checked;
    }
    else if (name in mapping) {
        return value.split(/[\s\n,;]+/).filter(v => !!v);
    }
    else if (name in offset) {
        return value * offset[name];
    }
    return value;
}

function getValue(name, value) {
    if (name in mapping) {
        return value.join(' ');
    }
    else if (name in offset) {
        return value / offset[name];
    }
    else {
        return value;
    }
}