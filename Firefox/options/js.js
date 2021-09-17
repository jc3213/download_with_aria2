document.querySelector('#manager').style.display = location.search === '?popup' ? 'none' : 'block';

document.querySelector('#export').addEventListener('click', (event) => {
    var blob = new Blob([JSON.stringify(aria2RPC)], {type: 'application/json; charset=utf-8'});
    var saver = document.createElement('a');
    saver.href = URL.createObjectURL(blob);
    saver.download = 'downwitharia2_options-' + new Date().toLocaleString('ja').replace(/[\/\s:]/g, '_') + '.json';
    saver.click();
});

document.querySelector('#import').addEventListener('click', (event) => {
    var file = document.createElement('input');
    file.type = 'file';
    file.accept = 'application/json';
    file.click();
    file.addEventListener('change', (event) => {
        var reader = new FileReader();
        reader.readAsText(event.target.files[0]);
        reader.onload = () => {
            var json = JSON.parse(reader.result);
            browser.storage.local.set(json);
            location.reload();
        };
    });
});

document.querySelector('#aria2_btn').addEventListener('click', (event) => {
    aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.getVersion', params: [token]},
    version => openModuleWindow('aria2Opt', 'aria2/index.html?' + version.version),
    error => showNotification(error));
});

document.querySelector('#show_btn').addEventListener('click', (event) => {
    document.querySelector('[root="jsonrpc"][local="token"]').setAttribute('type', event.target.className === 'checked' ? 'password' : 'text');
    event.target.classList.toggle('checked');
});

function aria2RPCAssist() {
    document.querySelectorAll('[local]').forEach(field => {
        var name = field.getAttribute('local');
        var root = field.getAttribute('root');
        root ? {[root]: {[name] : value}} = aria2RPC : {[name] : value} = aria2RPC;
        var array = Array.isArray(value);
        var token = field.getAttribute('token');
        var multi = field.getAttribute('multi');
        field.value = array ? value.join(' ') : token ? value.slice(token.length) : multi ? value / multi : value;
        field.addEventListener('change', (event) => {
            var value = array ? field.value.split(/[\s\n,]+/) : token ? 'token:' + field.value : multi ? field.value * multi : field.value;
            root ? aria2RPC[root][name] = value : aria2RPC[name] = value;
            browser.storage.local.set(aria2RPC);
        });
    });
    document.querySelectorAll('[gear]').forEach(gear => {
        var rule = gear.getAttribute('gear').split('&');
        var gate = rule[0].split(','), term = rule[1];
        var name = gate[0], root = gate[1];
        root ? {[root]: {[name] : value}} = aria2RPC : {[name] : value} = aria2RPC;
        var field = root ? '[local="' + name + '"][root="' + root + '"]' : '[local="' + name + '"]';
        gear.style.display = term.includes(value) ? 'block' : 'none';
        document.querySelector(field).addEventListener('change', (event) => {
            gear.style.display = term.includes(event.target.value) ? 'block' : 'none';
        });
    });
}
