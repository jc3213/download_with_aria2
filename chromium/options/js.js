var mapping = [
    'proxy_include',
    'capture_resolve',
    'capture_reject',
    'capture_include',
    'capture_exclude'
];
var offset = {
    'refresh_interval': 1000,
    'capture_size': 1048576
};
var linkage = {
    'folder_mode': [],
    'proxy_mode': [],
    'capture_mode': []
};
var changes = [];
var undones = [];
var backage = {};
var global = true;
var savebtn = document.querySelector('#save_btn');
var undobtn = document.querySelector('#undo_btn');
var redobtn = document.querySelector('#redo_btn');
var importbtn = document.querySelector('#import_btn');
var exportbtn = document.querySelector('#export_btn');
var secret = document.querySelector('[name="secret_token"]');

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
        aria2Store = applyChanges('#local');
        chrome.storage.local.set(aria2Store);
    }
    else {
        aria2Global = applyChanges('#aria2');
        aria2RPC.message('aria2.changeGlobalOption', [aria2Global]);
    }
});

undobtn.addEventListener('click', event => {
    var undo = changes.pop();
    var {name, old_value} = undo;
    undones.push(undo);
    savebtn.disabled = redobtn.disabled = false;
    document.querySelector('[name="' + name + '"]').value = old_value;
    printLinkage(name, old_value);
    if (changes.length === 0) {
        undobtn.disabled = true;
    }
});

redobtn.addEventListener('click', event => {
    var redo = undones.pop();
    var {name, new_value} = redo;
    changes.push(redo);
    savebtn.disabled = undobtn.disabled = false;
    document.querySelector('[name="' + name + '"]').value = new_value;
    printLinkage(name, new_value);
    if (undones.length === 0) {
        redobtn.disabled = true;
    }
});

document.querySelector('#back_btn').addEventListener('click', event => {
    aria2StartUp();
    clearChanges();
    global = true;
    document.body.setAttribute('data-main', 'local');
});

document.querySelector('#aria2_btn').addEventListener('click', event => {
    aria2RPC.message('aria2.getGlobalOption').then(options => {
        aria2Global = printGlobalOptions(options);
        clearChanges();
        global = false;
        document.body.setAttribute('data-main', 'aria2');
    });
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
    aria2Store = json;
    aria2StartUp();
    clearChanges();
    event.target.value = '';
});

document.querySelector('#show_btn').addEventListener('mousedown', event => {
    secret.type = 'text';
});

document.addEventListener('mouseup', event => {
    secret.type = 'password';
});

document.querySelector('#local').addEventListener('change', event => {
    var {name, value} = event.target;
    var array = mapping.includes(name);
    var multi = offset[name];
    var old_value = name in backage ? backage[name] : aria2Store[name];
    var new_value = array ? value.split(/[\s\n,;]+/).filter(v => !!v) : multi ? value * multi : value;
    printChanges(name, old_value, new_value);
});

document.querySelector('#aria2').addEventListener('change', event => {
    var {name, value} = event.target;
    var old_value = name in backage ? backage[name] : aria2Global[name];
    printChanges(name, old_value, value);
});

document.querySelectorAll('[data-link]').forEach(menu => {
    var link = menu.getAttribute('data-link');
    var split = link.indexOf(',');
    var name = link.slice(0, split);
    var rule = link.slice(split + 1);
    linkage[name].push({menu, rule});
});

chrome.storage.onChanged.addListener(changes => {
    if (changes['jsonrpc_uri'] || changes['secret_token']) {
        aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
    }
});

function aria2StartUp() {
    document.querySelectorAll('#local [name]').forEach(entry => {
        var {name} = entry;
        var array = mapping.includes(name);
        var multi = offset[name];
        var value = aria2Store[name];
        entry.value = array ? value.join(' ') : multi ? value / multi : value;
    });
    Object.keys(linkage).forEach(name => {
        var value = aria2Store[name];
        printLinkage(name, value);
    });
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
}

function printLinkage(name, value) {
    backage[name] = value;
    if (name in linkage) {
        linkage[name].forEach(chain => {
            var {menu, rule} = chain;
            menu.style.display = rule.includes(value) ? 'block' : 'none';
        });
    }
}

function clearChanges() {
    changes = [];
    undones = [];
    backage = {};
    savebtn.disabled = undobtn.disabled = redobtn.disabled = true;
}

function printChanges(name, old_value, new_value) {
    changes.push({name, old_value, new_value});
    savebtn.disabled = undobtn.disabled = false;
    redobtn.disabled = true;
    undones = [];
    printLinkage(name, new_value);
}

function applyChanges(path) {
    var options = {};
    document.querySelectorAll(path + ' [name]').forEach(entry => {
        var {name, value} = entry;
        var array = mapping.includes(name);
        var multi = offset[name];
        options[name] = array ? value.split(/[;\s\r\n]+/).filter(v => !!v) : multi ? value * multi : value;
    });
    savebtn.disabled = true;
    return options;
}
