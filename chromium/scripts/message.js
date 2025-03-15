const messageHandlers = {
    'aria2c_jsonrpc_echo': () => {
        let {name, version} = chrome.runtime.getManifest();
        window.postMessage({ extension_name: name, extension_version: version });
    },
    'aria2c_jsonrpc_call': (entries) => {
        let params = ( Array.isArray(entries) ? entries : [entries] ).filter( (entry) => entry?.url );
        chrome.runtime.sendMessage({ action: 'jsonrpc_download', params });
    }
};

window.addEventListener('message', (event) => {
    if (messageHandlers[event.data.aria2c]) {
        messageHandlers[event.data.aria2c](event.data.params);
    }
});
