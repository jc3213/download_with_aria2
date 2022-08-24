var mapping = ['proxy_include', 'capture_resolve', 'capture_reject', 'capture_include', 'capture_exclude'];
var offset = {'capture_size': 1048576};
var savebtn = document.querySelector('#save_btn');
var changes = [];
var glosave = document.querySelector('#glosav_btn');
var glochanges = [];
location.search === '?popup' ? document.querySelector('#manager').style.display =  'none' : document.querySelector('#popup_btn').style.display = 'none';

document.querySelector('#back_btn').addEventListener('click', event => {
    document.body.setAttribute('data-prefs', 'option');
});

document.querySelector('#aria2_btn').addEventListener('click', event => {
    aria2RPC.message('aria2.getGlobalOption').then(options => {
        aria2Global = options;
        printGlobalOptions(options, '#global [name]');
        document.body.setAttribute('data-prefs', 'global');
    });
});

savebtn.addEventListener('click', event => {
    applyChanges(changes, aria2Store);
    savebtn.style.display = 'none';
    chrome.storage.local.set(aria2Store);
});

glosave.addEventListener('click', event => {
    applyChanges(glochanges, aria2Global);
    glosave.style.display = 'none';
    aria2RPC.message('aria2.changeGlobalOption', [aria2Global]);
});

document.querySelector('#popup_btn').addEventListener('click', event => {
    open('/popup/index.html', '_self');
});

document.querySelector('#show_btn').addEventListener('click', event => {
    var input = event.target.parentNode.querySelector('input');
    input.type = input.type === 'password' ? 'text' : 'password';
});

document.querySelector('#export_btn').addEventListener('click', event => {
    var blob = new Blob([JSON.stringify(aria2Store)], {type: 'application/json; charset=utf-8'});
    var saver = document.createElement('a');
    saver.href = URL.createObjectURL(blob);
    saver.download = 'downwitharia2_options-' + new Date().toLocaleString('ja').replace(/[\/\s:]/g, '_') + '.json';
    saver.click();
});

document.querySelector('#import_btn').addEventListener('change', async event => {
    var json = await promiseFileReader(event.target.files[0], 'json');
    printOptions(json);
    chrome.storage.local.set(json);
    aria2Store = json;
});

document.querySelector('#option').addEventListener('change', event => {
    var name = event.target.name;
    var value = event.target.value;
    var array = mapping.includes(name);
    var multi = offset[name];
    var old_value = aria2Store[name];
    var new_value = array ? value.split(/[\s\n,;]+/).filter(v => !!v) : multi ? value * multi : value;
    printChanges(name, old_value, new_value, changes);
    savebtn.style.display = 'inline-block';
});

document.querySelector('#global').addEventListener('change', event => {
    var name = event.target.name;
    var old_value = aria2Global[name];
    var new_value = event.target.value;
    printChanges(name, old_value, new_value, glochanges);
    glosave.style.display = 'inline-block';
});

chrome.storage.onChanged.addListener(changes => {
    if (changes['jsonrpc_uri'] || changes['secret_token']) {
        aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
    }
});

function aria2RPCClient() {
    printOptions(aria2Store);
    document.querySelectorAll('[data-rule]').forEach(menu => {
        var rule = menu.getAttribute('data-rule').match(/[^,]+/g);
        var name = rule.shift();
        menu.style.display = rule.includes(aria2Store[name]) ? 'block' : 'none';
        document.querySelector('#option [name="' + name + '"]').addEventListener('change', event => {
            menu.style.display = rule.includes(event.target.value) ? 'block' : 'none';
        });
    });
}

function printChanges(name, old_value, new_value, changes) {
    var change = changes.find(change => change.name === name);
    if (change) {
        change['new_value'] = new_value;
    }
    else {
        changes.push({name, old_value, new_value});
    }
}

function applyChanges(changes, options) {
    if (changes.length !== 0) {
        var {name, new_value} = changes.pop();
        options[name] = new_value;
        applyChanges(changes, options);
    }
}

function printOptions(options) {
    document.querySelectorAll('#option [name]').forEach(field => {
        var name = field.name;
        var array = mapping.includes(name);
        var multi = offset[name];
        var value = options[name];
        field.value = array ? value.join(' ') : multi ? value / multi : value;
    });
}
