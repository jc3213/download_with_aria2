const messageHandlers = {
    'aria2c_status': (id) => {
        let result = chrome.runtime.getManifest();
        window.postMessage({ aria2c: 'aria2c_response', id, result });
    },
    'aria2c_download': (id, args) => {
        let params = ( Array.isArray(args) ? args : [args] ).filter( (arg) => arg?.url );
        chrome.runtime.sendMessage({ action: 'jsonrpc_download', params });
    }
};

window.addEventListener('message', (event) => {
    let {aria2c, id, params} = event.data;
    messageHandlers[aria2c]?.(id, params);
});
