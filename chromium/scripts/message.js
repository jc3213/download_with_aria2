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
    var {name, version} = chrome.runtime.getManifest();
    var message = chrome.i18n.getMessage('extension_echo').replace('{name}', name).replace('{version}', version);
    window.postMessage({ extension_name: name, extension_version: version, message});
}

function aria2RPCCall(params) {
    if (params?.urls || params?.torrents || params?.metalinks) {
        chrome.runtime.sendMessage({action: 'message_download', params});
    }
}
