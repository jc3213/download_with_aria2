var Storage;
var aria2Error = 0;
var aria2Live;

document.querySelectorAll('[i18n]').forEach(item => {
    item.innerText = chrome.i18n.getMessage(item.innerText);
});

document.querySelectorAll('[i18n_title]').forEach(item => {
    item.title = chrome.i18n.getMessage(item.title);
});

function aria2RPCCall(call, resolve, reject, alive) {
    var body = JSON.stringify( 'method' in call ? {id: '', jsonrpc: 2, method: call.method, params: [Storage['secret_token']].concat(call.params ?? [])}
        : {id: '', jsonrpc: 2, method: 'system.multicall', params: [ call.map(({method, params = []}) => ({methodName: method, params: [Storage['secret_token'], ...params]})) ]} );
    aria2RPCRequest() || alive && (aria2Live = setInterval(aria2RPCRequest, Storage['refresh_interval']));

    function aria2RPCRequest() {
        fetch(Storage['jsonrpc_uri'], {method: 'POST', body}).then(response => {
            if (response.status !== 200) {
                throw new Error(response.statusText);
            }
            return response.json();
        }).then(({result}) => {
            typeof resolve === 'function' && resolve(result);
        }).catch(error => {
            aria2Error === 0 && typeof reject === 'function' && (aria2Error = reject(error) ?? 1);
        });
    }
}

function readFileAsBinary(file, resolve) {
    var reader = new FileReader();
    reader.onload = () => resolve(reader.result.slice(reader.result.indexOf(',') + 1));
    reader.readAsDataURL(file);
}

function bytesToFileSize(bytes) {
    return bytes < 0 ? '?? B' : bytes < 1024 ? bytes + ' B' :
        bytes < 1048576 ? (bytes / 10.24 | 0) / 100 + ' KB' :
        bytes < 1073741824 ? (bytes / 10485.76 | 0) / 100 + ' MB' :
        bytes < 1099511627776 ? (bytes / 10737418.24 | 0) / 100 + ' GB' : (bytes / 10995116277.76 | 0) / 100 + ' TB';
}

function printOptions(entries, options) {
    entries.forEach(entry => {
        entry.value = options[entry.name] ?? '';
        if (entry.hasAttribute('data-size')) {
            var size = bytesToFileSize(entry.value);
            entry.value = size.slice(0, size.indexOf(' ')) + size.slice(size.indexOf(' ') + 1, -1);
        }
    });
}
