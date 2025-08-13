const messageHandlers = {
    'aria2c_jsonrpc_echo': () => {
        let {name, version} = chrome.runtime.getManifest();
        window.postMessage({ aria2c: 'aria2c_response_echo', name, version });
    },
    'aria2c_jsonrpc_call': (arg) => {
        let params = ( Array.isArray(arg) ? arg : [arg] ).filter( (entry) => entry?.url );
        chrome.runtime.sendMessage({ action: 'download_urls', params });
    }
};

window.addEventListener('message', (event) => {
    let {aria2c, params} = event.data;
    let handler = messageHandlers[aria2c];
    handler?.(params);
});
