window.addEventListener('message', (event) => {
    switch(event.data.aria2c) {
        case 'aria2c_jsonrpc_echo':
            aria2RPCEcho();
            break;
        case 'aria2c_jsonrpc_call':
            aria2RPCCall(event.data.params);
            break;
    }
});

function aria2RPCEcho() {
    let {name, version} = chrome.runtime.getManifest();
    window.postMessage({ extension_name: name, extension_version: version });
}

function aria2RPCCall(entries) {
    let params = ( Array.isArray(entries) ? entries : [entries] ).filter( (entry) => entry?.url );
    chrome.runtime.sendMessage({ action: 'jsonrpc_download', params });
}
