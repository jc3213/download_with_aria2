document.querySelector('#manager').style.display = location.search === '?popup' ? 'none' : 'block';
document.querySelector('#back').parentNode.style.display = location.search === '?popup' ? 'block' : 'none';

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

document.querySelector('#aria2_btn').addEventListener('click', event => {
    aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.getVersion', params: [aria2RPC.jsonrpc['token']]},
    version => open('aria2/index.html?' + version.version, '_self'),
    error => showNotification(error));
});

document.querySelector('#show_btn').addEventListener('click', event => {
    event.target.parentNode.querySelector('input').setAttribute('type', event.target.classList.contains('checked') ? 'password' : 'text');
    event.target.classList.toggle('checked');
});

function aria2RPCClient() {
    document.querySelectorAll('[local]').forEach(field => {
        var name = field.getAttribute('local');
        var root = field.getAttribute('root');
        var value = root ? aria2RPC[root][name] : aria2RPC[name] ?? '';
        var array = Array.isArray(value);
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
