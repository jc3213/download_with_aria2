function printFeedButton() {
    document.querySelectorAll('[feed]').forEach(field => {
        var feed = field.getAttribute('feed');
        var name = field.getAttribute('local');
        var root = field.getAttribute('root');
        root ? {[root]: {[name] : value}} = aria2RPC : {[name] : value} = aria2RPC;
        field.addEventListener('click', event => {
            document.querySelector('[task="' + feed + '"]').value = value;
        });
    });
}

function parseValueToOption(field, type, options) {
    var name = field.getAttribute(type);
    if (field.hasAttribute('size')) {
        var size = bytesToFileSize(options[name]);
        field.value = size.slice(0, size.indexOf(' ')) + size.slice(size.indexOf(' ') + 1, -1);
    }
    else {
        field.value = options[name] ?? '';
    }
}

function printGlobalOption() {
    aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.getGlobalOption', params: [aria2RPC.jsonrpc['token']]},
    options => document.querySelectorAll('[aria2]').forEach(aria2 => parseValueToOption(aria2, 'aria2', options)));
}
