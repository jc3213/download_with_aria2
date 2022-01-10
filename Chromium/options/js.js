document.querySelectorAll('[data-option] > button, [data-global] > button').forEach((tab, index) => {
    var type = index < 3 ? 'option' : 'global';
    var value = index < 3 ? index + 1 : index - 2;
    tab.addEventListener('click', event => {
        tab.parentNode.setAttribute('data-' + type, value);
        document.querySelector('#' + type).setAttribute('data-' + type, value);
    });
});

'browser' in this ? document.querySelector('[data-chrome]').remove() : document.querySelector('[data-firefox]').remove();

document.querySelector('#manager').style.display = location.search === '?popup' ? 'none' : 'block';
document.querySelector('#back_btn').style.display = location.search === '?popup' ? 'inline-block' : 'none';

document.querySelector('#back_btn').addEventListener('click', event => {
    history.back();
});

document.querySelector('#export_btn').addEventListener('click', event => {
    var blob = new Blob([JSON.stringify(aria2RPC)], {type: 'application/json; charset=utf-8'});
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
    document.body.getAttribute('data-prefs') === 'option' ? document.body.setAttribute('data-prefs', 'global') : document.body.setAttribute('data-prefs', 'option');
});

document.querySelector('#global').addEventListener('change', event => {
    aria2RPCCall({method: 'aria2.changeGlobalOption', params: [{[event.target.name]: event.target.value}]});
});

function aria2RPCClient() {
    aria2RPCCall({method: 'aria2.getGlobalOption'}, options => {
        document.querySelector('#aria2_btn').style.display = 'inline-block';
        printOptions(document.querySelectorAll('#global [name]'), options);
    }, error => document.querySelector('#aria2_btn').style.display = 'none');
    document.querySelectorAll('#option [id]:not(button)').forEach(field => {
        var name = field.id;
        var root = field.name;
        var value = root in aria2RPC ? aria2RPC[root][name] : aria2RPC[name] ?? '';
        var array = value.constructor === Array;
        var token = field.getAttribute('data-token');
        var multi = field.getAttribute('data-multi');
        field.value = array ? value.join(' ') : token ? value.slice(token.length) : multi ? value / multi : value;
        field.addEventListener('change', event => {
            var value = array ? field.value.split(/[\s\n,]+/) : token ? token + field.value : multi ? field.value * multi : field.value;
            root ? aria2RPC[root][name] = value : aria2RPC[name] = value;
            chrome.storage.local.set(aria2RPC);
        });
    });
    document.querySelectorAll('[data-rule]').forEach(menu => {
        var rule = menu.getAttribute('data-rule').match(/[^,]+/g);
        var root = rule.shift();
        var value = aria2RPC[root]['mode'];
        menu.style.display = rule.includes(value) ? 'block' : 'none';
        document.querySelector('#mode[name="' + root + '"]').addEventListener('change', event => {
            menu.style.display = rule.includes(event.target.value) ? 'block' : 'none';
        });
    });
}
