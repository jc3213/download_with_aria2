function aria2EchoResponse() {
    let {name, version} = chrome.runtime.getManifest();
    window.postMessage({ aria2c: 'aria2c_response_echo', name, version });
}

function aria2CallHandler (args) {
    let params = ( Array.isArray(args) ? args : [args] ).filter( (entry) => entry?.url );
    chrome.runtime.sendMessage({ action: 'jsonrpc_download', params });
}

window.addEventListener('message', (event) => {
    let {aria2c, params} = event.data;
    if (!aria2c) {
        return;
    }
    switch (aria2c) {
        case 'aria2c_jsonrpc_echo':
            aria2EchoResponse();
            break;
        case 'aria2c_jsonrpc_call':
            aria2CallHandler(params);
            break;
    };
});
