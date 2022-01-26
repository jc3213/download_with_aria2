location.search === '?popup' ? document.querySelector('#manager').style.display =  'none' : document.querySelector('#back_btn').style.display = 'none';

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
    var blob = new Blob([JSON.stringify(Storage)], {type: 'application/json; charset=utf-8'});
    var saver = document.createElement('a');
    saver.href = URL.createObjectURL(blob);
    saver.download = 'downwitharia2_options-' + new Date().toLocaleString('ja').replace(/[\/\s:]/g, '_') + '.json';
    saver.click();
});

document.querySelector('#import_btn').addEventListener('change', event => {
    readFileAsBinary(event.target.files[0], data => {
        chrome.storage.local.set(JSON.parse(atob(data)));
        location.reload();
    });
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

chrome.storage.local.get(null, result => {
    Storage = result;
    document.querySelectorAll('#option [name]').forEach(field => {
        var value = Storage[field.name];
        var array = value.constructor === Array;
        var token = field.getAttribute('data-token');
        var multi = field.getAttribute('data-multi');
        field.value = array ? value.join(' ') : token ? value.slice(token.length) : multi ? value / multi : value;
        field.addEventListener('change', event => {
            Storage[field.name] = array ? field.value.split(/[\s\n,]+/) : token ? token + field.value : multi ? field.value * multi : field.value;
            chrome.storage.local.set(Storage);
        });
    });
    document.querySelectorAll('[data-rule]').forEach(menu => {
        var rule = menu.getAttribute('data-rule').match(/[^,]+/g);
        var name = rule.shift();
        menu.style.display = rule.includes(Storage[name]) ? 'block' : 'none';
        document.querySelector('#option [name="' + name + '"]').addEventListener('change', event => {
            menu.style.display = rule.includes(event.target.value) ? 'block' : 'none';
        });
    });
});
