function printFeedButton() {
    document.querySelectorAll('button[local]').forEach(button => {
        var field = button.parentNode.querySelector('input');
        var name = button.getAttribute('local');
        var root = button.getAttribute('root');
        var value = root ? aria2RPC[root][name] : aria2RPC[name];
        button.addEventListener('click', event => {
            field.value = value;
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
