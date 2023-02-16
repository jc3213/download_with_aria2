var savebtn = document.querySelector('#save_btn');
var undobtn = document.querySelector('#undo_btn');
var redobtn = document.querySelector('#redo_btn');
var importbtn = document.querySelector('#import_btn');
var exportbtn = document.querySelector('#export_btn');
var secret = document.querySelector('[name="jsonrpc_token"]');
var changes = {};
var redoes = [];
var undoes = [];
var global = true;
var rulelist = document.querySelectorAll('#local > [id]');
var listed = {};
var listLET = document.querySelector('.item');
var checkbox = {
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
    var undo = undoes.pop();
    var {name, old_value} = undo;
    redoes.push(undo);
    redobtn.disabled = false;
    getChange(name, old_value);
    if (undoes.length === 0) {
        undobtn.disabled = true;
    }
});

redobtn.addEventListener('click', event => {
    var redo = redoes.pop();
    var {name, new_value} = redo;
    undoes.push(redo);
    undobtn.disabled = false;
    getChange(name, new_value);
    if (redoes.length === 0) {
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
    if (name) {
        console.log(name ,value , checked);
        var new_value = getValue(name, value, checked);
        setChange(name, new_value);
    }
});

document.querySelector('#aria2').addEventListener('change', event => {
    var {name, value} = event.target;
    setChange(name, value);
});

rulelist.forEach(menu => {
    var name = menu.id;
    var entry = menu.querySelector('input');
    var addbtn = menu.querySelector('button');
    var list = menu.querySelector('.list');
    entry.addEventListener('keydown', event => {
        if (event.keyCode === 13) {
            addbtn.click();
        }
    });
    addbtn.addEventListener('click', event => {
        var {value} = entry;
        if (value !== '') {
            var item = printList(name, value);
            list.appendChild(item);
            var new_value = [...changes[name], value];
            setChange(name, new_value);
            entry.value = '';
        }
    });
    listed[name] = 1;
    menu.match = {name, list};
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
    rulelist.forEach(menu => {
        var {name, list} = menu.match;
        changes[name].forEach(value => {
            var item = printList(name, value);
            list.appendChild(item);
        });
    });
    document.querySelectorAll('#local [name]').forEach(entry => {
        var {name} = entry;
        var value = aria2Store[name];
        if (name in checkbox) {
            entry.checked = value;
        }
        else {
            entry.value = setValue(name, value);
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
    undoes = [];
    redoes = [];
    savebtn.disabled = undobtn.disabled = redobtn.disabled = true;
}

function getChange(name, value) {
    changes[name] = value;
    savebtn.disabled = false;
    var entry = document.querySelector('[name="' + name + '"]');
    if (name in listed) {
        getList(name, value);
    }
    else if (name in checkbox) {
        entry.checked = value;
    }
    else {
        entry.value = setValue(name, value);
    }
    if (name in linkage) {
        linkage[name].forEach(printLinkage);
    }
}

function setChange(name, new_value) {
    var old_value = changes[name];
    undoes.push({name, old_value, new_value});
    savebtn.disabled = undobtn.disabled = false;
    changes[name] = new_value;
    if (name in linkage) {
        linkage[name].forEach(printLinkage);
    }
}

function getValue(name, value, checked) {
    if (name in checkbox) {
        return checked;
    }
    else if (name in offset) {
        return value * offset[name];
    }
    return value;
}

function setValue(name, value) {
    if (name in offset) {
        return value / offset[name];
    }
    else {
        return value;
    }
}

function setList(name, value) {
    var list = document.querySelector('#' + name + ' > .list');
    var item = printList(name, value);
    list.appendChild(item);
    return [...changes[name], value];
}

function getList(name, value) {
    var list = document.querySelector('#' + name + ' > .list');
    list.innerHTML = '';
    value.forEach(val => {
        var item = printList(name, val);
        list.appendChild(item);
    });
}

function printList(name, value) {
    var item = listLET.cloneNode(true)
    item.querySelector('span').innerText = value;
    item.querySelector('button').addEventListener('click', event => {
        var idx = old_value.indexOf(value);
        var new_value = [...old_value.slice(0, idx), ...old_value.slice(idx + 1)];
        setChange(name, new_value);
        item.remove();
    });
    return item;
}
