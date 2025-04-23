const messageHandlers = {
    'aria2c_jsonrpc_echo': () => {
        let {name, version} = chrome.runtime.getManifest();
        window.postMessage({ aria2c: 'aria2c_response_echo', name, version });
    },
    'aria2c_jsonrpc_call': (args) => {
        let params = ( Array.isArray(args) ? args : [args] ).filter( (entry) => entry?.url );
        chrome.runtime.sendMessage({ action: 'jsonrpc_download', params });
    }
};

window.addEventListener('message', (event) => {
    let handler = messageHandlers[event.data.aria2c];
    if (handler) {
        handler(event.data.params);
    }
});
