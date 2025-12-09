function messgeChannel(id, message) {
    chrome.runtime.sendMessage(message, (result) => {
        window.postMessage({ aria2c: 'aria2c_response', id, result });
    });
}

function downloadHandler(id, args) {
    let params = [];
    for (let arg of args) {
        let otype = typeof arg;
        if (otype === 'string') {
            params.push({ method: 'aria2.addUri', params: [[arg]] });
        } else if (otype === 'object' && arg.url) {
            params.push({ method: 'aria2.addUri', params: [[arg.url], arg.options ?? {}] });
        }
    }
    messgeChannel(id, { action: 'jsonrpc_download', params });
}

const messageDispatch = {
    'aria2c_status': (id) => messgeChannel(id, { action: 'system_runtime' }),
    'aria2c_download': downloadHandler
};

window.addEventListener('message', (event) => {
    let { aria2c, id, params } = event.data;
    messageDispatch[aria2c]?.(id, params);
});
