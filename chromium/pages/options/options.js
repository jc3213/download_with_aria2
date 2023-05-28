var savebtn = document.querySelector('#save_btn');
var undobtn = document.querySelector('#undo_btn');
var redobtn = document.querySelector('#redo_btn');
var importbtn = document.querySelector('#import_btn');
var exportbtn = document.querySelector('#export_btn');
var aria2Ver = document.querySelector('#aria2ver');
var aria2UA = document.querySelector('#aria2ua');
var secret = document.querySelector('#jsonrpc_token');
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

savebtn.addEventListener('click', (event) => {
    if (global) {
        aria2Store = {...changes};
        chrome.storage.local.set(changes);
    }
    else {
        aria2RPC.call('aria2.changeGlobalOption', [changes]);
    }
    savebtn.disabled = true;
});

undobtn.addEventListener('click', (event) => {
    var undo = undoes.pop();
    var {id, old_value} = undo;
    redoes.push(undo);
    redobtn.disabled = false;
    undone = true;
    getChange(id, old_value);
    if (undoes.length === 0) {
        undobtn.disabled = true;
    }
});

redobtn.addEventListener('click', (event) => {
    var redo = redoes.pop();
    var {id, new_value} = redo;
    undoes.push(redo);
    undobtn.disabled = false;
    getChange(id, new_value);
    if (redoes.length === 0) {
        redobtn.disabled = true;
    }
});

document.querySelector('#version').innerText = chrome.runtime.getManifest().version;

document.querySelector('#back_btn').addEventListener('click', (event) => {
    clearChanges();
    global = true;
    aria2StartUp();
    document.body.className = 'local';
});

document.querySelector('#aria2_btn').addEventListener('click', async (event) => {
    var [options, version] = await aria2RPC.batch([
        {method: 'aria2.getGlobalOption'},
        {method: 'aria2.getVersion'}
    ]);
    clearChanges();
    global = false;
    aria2Global = document.querySelectorAll('#aria2 input').disposition(options);
    changes = {...aria2Global};
    aria2Ver.innerText = aria2UA.innerText = version.version;
    document.body.className = 'aria2';
});

exportbtn.addEventListener('click', (event) => {
    var blob = new Blob([JSON.stringify(aria2Store)], {type: 'application/json; charset=utf-8'});
    var saver = document.createElement('a');
    saver.href = URL.createObjectURL(blob);
    saver.download = `downwitharia2_options-${new Date().toLocaleString('ja').replace(/[\/\s:]/g, '_')}.json`;
    saver.click();
});

importbtn.addEventListener('change', async ({target}) => {
    var json = await getOptionsJSON(target.files[0]);
    chrome.storage.local.set(json);
    clearChanges();
    aria2Store = json;
    aria2StartUp();
    target.value = '';
});

document.querySelector('#show_btn').addEventListener('mousedown', (event) => {
    secret.type = 'text';
});

document.addEventListener('mouseup', (event) => {
    secret.type = 'password';
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
    checked[id] = 1;
});

rulelist.forEach(menu => {
    var id = menu.getAttribute('data-list');
    var entry = menu.querySelector('input');
    var addbtn = menu.querySelector('button');
    var list = menu.querySelector('.rulelist');
    entry.addEventListener('keydown', ({keyCode}) => {
        if (keyCode === 13) {
            addbtn.click();
        }
    });
    addbtn.addEventListener('click', (event) => {
        var {value} = entry;
        if (value !== '') {
            var new_value = [...changes[id], value];
            setChange(id, new_value);
            entry.value = '';
            printList(list, id, value);
        }
    });
    listed[id] = 1;
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
        changes[id].forEach((value) => printList(list, id, value));
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
    changes = {};
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
    var list = document.querySelector(`[data-list="${id}"] > .rulelist`);
    list.innerHTML = '';
    value.forEach((val) => printList(list, id, val));
}

function printList(list, id, value) {
    var item = listLET.cloneNode(true)
    item.querySelector('span').innerText = value;
    item.querySelector('button').addEventListener('click', (event) => {
        var new_value = [...changes[id]];
        new_value.splice(new_value.indexOf(value), 1);
        setChange(id, new_value);
        item.remove();
    });
    list.append(item);
}

function getOptionsJSON(file) {
    return new Promise((resolve) => {
        var reader = new FileReader();
        reader.onload = (event) => {
            var json = JSON.parse(reader.result);
            resolve(json);
        };
        reader.readAsText(file);
    });
}
