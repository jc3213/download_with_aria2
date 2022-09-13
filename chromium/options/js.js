var mapping = 'proxy_include,capture_resolve,capture_reject,capture_include,capture_exclude';
var offset = {'refresh_interval': 1000, 'capture_size': 1048576};
var linkage = {'folder_mode': [], 'proxy_mode': [], 'capture_mode': []};
var changes = [];
var undones = [];
var global = true;
var savebtn = document.querySelector('#save_btn');
var undobtn = document.querySelector('#undo_btn');
var redobtn = document.querySelector('#redo_btn');
var importbtn = document.querySelector('#import_btn');
var exportbtn = document.querySelector('#export_btn');
var popupbtn = document.querySelector('#popup_btn');

if (location.search === '?popup') {
    importbtn.style.display = exportbtn.style.display = 'none'
}
else {
    popupbtn.style.display = 'none';
}

savebtn.addEventListener('click', event => {
    if (global) {
        applyChanges(aria2Store);
        chrome.storage.local.set(aria2Store);
    }
    else {
        applyChanges(aria2Global);
        aria2RPC.message('aria2.changeGlobalOption', [aria2Global]);
    }
});

undobtn.addEventListener('click', event => {
    var undo = changes.pop();
    var {name, old_value} = undo;
    document.querySelector('[name="' + name + '"]').value = old_value;
    undones.push(undo);
    redobtn.disabled = false;
    printLinkage(name, old_value);
    if (changes.length === 0) {
        undobtn.disabled = true;
    }
});

redobtn.addEventListener('click', event => {
    var redo = undones.pop();
    var {name, new_value} = redo;
    document.querySelector('[name="' + name + '"]').value = new_value;
    changes.push(redo);
    undobtn.disabled = false;
    printLinkage(name, new_value);
    if (undones.length === 0) {
        redobtn.disabled = true;
    }
});

popupbtn.addEventListener('click', event => {
    open('/popup/index.html', '_self');
});

document.querySelector('#back_btn').addEventListener('click', event => {
    printOptions(aria2Store);
    clearChanges();
    global = true;
    document.body.setAttribute('data-prefs', 'option');
});

document.querySelector('#aria2_btn').addEventListener('click', event => {
    aria2RPC.message('aria2.getGlobalOption').then(options => {
        printGlobalOptions(options, '#global [name]');
        aria2Global = options;
        clearChanges();
        global = false;
        document.body.setAttribute('data-prefs', 'global');
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
    printOptions(json);
    event.target.value = '';
});

document.querySelector('#show_btn').addEventListener('click', event => {
    var input = event.target.parentNode.querySelector('input');
    input.type = input.type === 'password' ? 'text' : 'password';
});

document.querySelector('#option').addEventListener('change', event => {
    var {name, value} = event.target;
    var array = mapping.includes(name);
    var multi = offset[name];
    var old_value = aria2Store[name];
    var new_value = array ? value.split(/[\s\n,;]+/).filter(v => !!v) : multi ? value * multi : value;
    printChanges(name, old_value, new_value);
});

document.querySelector('#global').addEventListener('change', event => {
    var {name, value} = event.target;
    var old_value = aria2Global[name];
    printChanges(name, old_value, value);
});

chrome.storage.onChanged.addListener(changes => {
    if (changes['jsonrpc_uri'] || changes['secret_token']) {
        aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
    }
});

function aria2StartUp() {
    printOptions(aria2Store);
    document.querySelectorAll('[data-link]').forEach(menu => {
        var link = menu.getAttribute('data-link');
        var split = link.indexOf(',');
        var name = link.slice(0, split);
        var rule = link.slice(split + 1);
        var value = aria2Store[name];
        linkage[name].push({menu, rule});
        menu.style.display = rule.includes(value) ? 'block' : 'none';
    });
}

function printOptions(options) {
    document.querySelectorAll('#option [name]').forEach(field => {
        var {name} = field;
        var array = mapping.includes(name);
        var multi = offset[name];
        var value = options[name];
        field.value = array ? value.join(' ') : multi ? value / multi : value;
    });
}

function printLinkage(name, value) {
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
    savebtn.disabled = undobtn.disabled = redobtn.disabled = true;
}

function printChanges(name, old_value, new_value) {
    var change = changes.find(change => change.name === name);
    changes.push({name, old_value, new_value});
    savebtn.disabled = undobtn.disabled = false;
    printLinkage(name, new_value);
}

function applyChanges(options) {
    changes.forEach(change => {
        var {name, new_value} = change;
        options[name] = new_value;
    });
    clearChanges();
}
