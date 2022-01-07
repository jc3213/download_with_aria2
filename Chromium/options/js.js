document.querySelector('#manager').style.display = location.search === '?popup' ? 'none' : 'block';
document.querySelector('#back').style.display = location.search === '?popup' ? 'inline-block' : 'none';

[
    {active: 0, tabs: document.querySelectorAll('[data-normal] > button'), subs: document.querySelectorAll('[data-normal] > .submenu')},
    {active: 0, tabs: document.querySelectorAll('[data-global] > button'), subs: document.querySelectorAll('[data-global] > .submenu')}
].forEach(({active, tabs, subs}, index) => {
    tabs[active].classList.add('checked');
    tabs.forEach((tab, index) => {
        tab.addEventListener('click', event => {
            tabs[active].classList.remove('checked');
            subs[active].style.display = 'none';
            active = index;
            tabs[index].classList.add('checked');
            subs[index].style.display = 'block';
        });
    });
});

document.querySelector('#back').addEventListener('click', event => {
    history.back();
});

document.querySelector('#export').addEventListener('click', event => {
    var blob = new Blob([JSON.stringify(aria2RPC)], {type: 'application/json; charset=utf-8'});
    var saver = document.createElement('a');
    saver.href = URL.createObjectURL(blob);
    saver.download = 'downwitharia2_options-' + new Date().toLocaleString('ja').replace(/[\/\s:]/g, '_') + '.json';
    saver.click();
});

document.querySelector('#import').addEventListener('change', event => {
    readFileAsBinary(event.target.files[0], data => {
        chrome.storage.local.set(JSON.parse(atob(data)));
        location.reload();
    });
});

document.querySelector('#global_btn').addEventListener('click', event => {
    document.body.getAttribute('data-mode') !== 'normal' ? document.body.setAttribute('data-mode', 'normal')
        : aria2RPCCall({method: 'aria2.getGlobalOption'}, options => document.body.setAttribute('data-mode', 'global') ?? printOptions(options), showNotification);
    event.target.classList.toggle('checked');
});

document.querySelector('#show_btn').addEventListener('click', event => {
    event.target.parentNode.querySelector('input').setAttribute('type', event.target.classList.contains('checked') ? 'password' : 'text');
    event.target.classList.toggle('checked');
});

document.querySelector('[data-global]').addEventListener('change', event => {
    aria2RPCCall({method: 'aria2.changeGlobalOption', params: [{[event.target.getAttribute('aria2')]: event.target.value}]});
});

function aria2RPCClient() {
    document.querySelectorAll('[local]').forEach(field => {
        var name = field.getAttribute('local');
        var root = field.getAttribute('root');
        var value = root in aria2RPC ? aria2RPC[root][name] : aria2RPC[name] ?? '';
        var array = value.constructor === Array;
        var token = field.getAttribute('token');
        var multi = field.getAttribute('multi');
        field.value = array ? value.join(' ') : token ? value.slice(token.length) : multi ? value / multi : value;
        field.addEventListener('change', event => {
            var value = array ? field.value.split(/[\s\n,]+/) : token ? 'token:' + field.value : multi ? field.value * multi : field.value;
            root ? aria2RPC[root][name] = value : aria2RPC[name] = value;
            chrome.storage.local.set(aria2RPC);
        });
    });
    document.querySelectorAll('[tree]').forEach(menu => {
        var root = menu.getAttribute('tree');
        var rule = menu.getAttribute('rule');
        var value = aria2RPC[root]['mode'];
        menu.style.display = rule.includes(value) ? 'block' : 'none';
        document.querySelector('[root="' + root + '"][local="mode"]').addEventListener('change', event => {
            menu.style.display = rule.includes(event.target.value) ? 'block' : 'none';
        });
    });
}
