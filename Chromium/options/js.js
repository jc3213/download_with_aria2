var profile_manager = document.querySelector('#default_profile');
var profile_name = document.querySelector('#jsonrpc_name');
var profile_jsonrpc = document.querySelector('#jsonrpc_uri');
var profile_secret = document.querySelector('#secret_token');
location.search === '?popup' ? document.querySelector('#manager').style.display =  'none' : document.querySelector('#back_btn').style.display = 'none';

profile_manager.addEventListener('change', event => {
    var index = event.target.value | 0;
    if (index === 999) {
        printProfileDetail(index, 'New Profile(' + aria2Store['jsonrpc_profile'].length + ')', 'http://localhost:6800/jsonrpc', '');
    }
    else {
        var {name, jsonrpc, secret} = aria2Store['jsonrpc_profile'][index];
        printProfileDetail(index, name, jsonrpc, secret);
    }
});

document.querySelector('#create_btn').addEventListener('click', event => {
    var index = profile_manager.value | 0;
    var profile = index === 999 ? aria2Store['jsonrpc_profile'].length : index;
    index === 999 ? printNewProfile(profile, profile_name.value) : profile_manager.querySelector('option:nth-child(' + (index + 1) + ')').innerText = profile_name.value;
    setProfileDetail(profile);
    chrome.storage.local.set(aria2Store);
});

document.querySelector('#remove_btn').addEventListener('click', event => {
    var index = profile_manager.value | 0;
    if (index !== 0 && confirm('Are you S ure?')) {
        profile_manager.querySelector('option[value="' + index + '"]').remove();
        var {name, jsonrpc, secret} = aria2Store['jsonrpc_profile'][0];
        printProfileDetail(0, name, jsonrpc, secret);
        aria2Store['jsonrpc_profile'].splice(index, 1);
        aria2Store['default_profile'] = '0';
        chrome.storage.local.set(aria2Store);
    }
});

document.querySelector('#default_btn').addEventListener('click', event => {
    var index = profile_manager.value;
    if (index !== aria2Store['default_profile'] && confirm('Are you S ure?')) {
        index = index | 0;
        var profile = index === 999 ? aria2Store['jsonrpc_profile'].length : index;
        index === 999 && printNewProfile(profile, profile_name.value);
        setProfileDetail(profile);
        aria2Store['default_profile'] = profile + '';
        chrome.storage.local.set(aria2Store);
    }
});

document.querySelectorAll('[data-option] > button, [data-global] > button').forEach((tab, index) => {
    var type = index < 3 ? 'option' : 'global';
    var value = index < 3 ? index + 1 : index - 2;
    tab.addEventListener('click', event => {
        tab.parentNode.setAttribute('data-' + type, value);
        document.querySelector('#' + type).setAttribute('data-' + type, value);
    });
});

document.querySelector('#back_btn').addEventListener('click', event => {
    open('/popup/index.html', '_self');
});

document.querySelector('#show_btn').addEventListener('click', event => {
    event.target.parentNode.querySelector('input').type = event.target.parentNode.querySelector('input').type === 'password' ? 'text' : 'password';
});

document.querySelector('#export_btn').addEventListener('click', event => {
    var blob = new Blob([JSON.stringify(aria2Store)], {type: 'application/json; charset=utf-8'});
    var saver = document.createElement('a');
    saver.href = URL.createObjectURL(blob);
    saver.download = 'downwitharia2_options-' + new Date().toLocaleString('ja').replace(/[\/\s:]/g, '_') + '.json';
    saver.click();
});

document.querySelector('#import_btn').addEventListener('change', async event => {
    var text = await promiseFileReader(event.target.files[0]);
    chrome.storage.local.set(JSON.parse(text));
    setTimeout(() => location.reload(), 500);
});

document.querySelector('#aria2_btn').addEventListener('click', event => {
    document.body.getAttribute('data-prefs') === 'global' ? document.body.setAttribute('data-prefs', 'option') :
        aria2RPCCall({method: 'aria2.getGlobalOption'}, options => {
            document.querySelector('#aria2_btn').style.display = 'inline-block';
            printOptions(document.querySelectorAll('#global [name]'), options);
            document.body.setAttribute('data-prefs', 'global');
        });
});

document.querySelector('#global').addEventListener('change', event => {
    aria2RPCCall({method: 'aria2.changeGlobalOption', params: [{[event.target.name]: event.target.value}]});
});

function aria2RPCClient() {
    aria2Store['jsonrpc_profile'].forEach(({name, jsonrpc, secret}, index) => {
        printNewProfile(index, name);
        aria2Store['default_profile'] === index + '' && printProfileDetail(index, name, jsonrpc, secret);
    });
    document.querySelector('#default_profile').value = aria2Store['default_profile'];
    document.querySelectorAll('#option [name]').forEach(field => {
        var value = aria2Store[field.name];
        var array = Array.isArray(value);
        var multi = field.getAttribute('data-multi');
        field.value = array ? value.join(' ') : multi ? value / multi : value;
        field.addEventListener('change', event => {
            aria2Store[field.name] = array ? field.value.split(/[\s\n,]+/) : multi ? field.value * multi : field.value;
            chrome.storage.local.set(aria2Store);
        });
    });
    document.querySelectorAll('[data-rule]').forEach(menu => {
        var rule = menu.getAttribute('data-rule').match(/[^,]+/g);
        var name = rule.shift();
        menu.style.display = rule.includes(aria2Store[name]) ? 'block' : 'none';
        document.querySelector('#option [name="' + name + '"]').addEventListener('change', event => {
            menu.style.display = rule.includes(event.target.value) ? 'block' : 'none';
        });
    });
}

function printNewProfile(index, name) {
    var options = profile_manager.querySelectorAll('option');
    var menu = options[index + 1] ?? document.createElement('option');
    menu.value = index;
    menu.innerText = name;
    profile_manager.insertBefore(menu, options[index]);
    profile_manager.value = index;
}

function printProfileDetail(index, name, jsonrpc, secret) {
    profile_name.value = name;
    profile_name.disabled = index === 0 ? true : false;
    profile_jsonrpc.value = jsonrpc;
    profile_secret.value = secret.slice(6);
}

function setProfileDetail(index) {
    aria2Store['jsonrpc_profile'][index] = {
        name: profile_name.value,
        jsonrpc: profile_jsonrpc.value,
        secret: 'token:' + profile_secret.value
    };
}
