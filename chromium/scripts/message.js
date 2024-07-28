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
    window.postMessage({extension_name: 'Download With Aria2', source: 'aria2c'});
}

function aria2RPCCall(params) {
    if (params?.urls || params?.torrents || params?.metalinks) {
        chrome.runtime.sendMessage({action: 'message_download', params});
    }
}
