var mapping = 'proxy_include,capture_resolve,capture_reject,capture_include,capture_exclude';
var offset = {'refresh_interval': 1000, 'capture_size': 1048576};
var changes = [];
var global = true;
var savebtn = document.querySelector('#save_btn');
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
    document.querySelectorAll('[data-mode]').forEach(menu => {
        var rule = menu.getAttribute('data-mode').match(/[^,]+/g);
        var name = rule.shift();
        menu.style.display = rule.includes(aria2Store[name]) ? 'block' : 'none';
        document.querySelector('#option [name="' + name + '"]').addEventListener('change', event => {
            menu.style.display = rule.includes(event.target.value) ? 'block' : 'none';
        });
    });
}

function clearChanges() {
    changes = [];
    savebtn.disabled = true;
}

function printChanges(name, old_value, new_value) {
    var change = changes.find(change => change.name === name);
    if (change) {
        change['new_value'] = new_value;
    }
    else {
        changes.push({name, old_value, new_value});
    }
    savebtn.disabled = false;
}

function applyChanges(options) {
    changes.forEach(change => {
        var {name, new_value} = change;
        options[name] = new_value;
    });
    clearChanges();
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
