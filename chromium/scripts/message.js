function systemStatus(id) {
    chrome.runtime.sendMessage({ action: 'jsonrpc_status' } , (result) => {
        window.postMessage({ aria2c: 'aria2c_response', id, result });
    });
}

function jsonrpcDownload(id, array) {
    let params = [];
    for (let i of array) {
        if (typeof i === 'string') {
            params.push({ method: 'aria2.addUri', params: [[i]] });
        } else if (i?.url) {
            params.push({ method: 'aria2.addUri', params: [[i.url], i.options ?? {}] });
        }
    }
    chrome.runtime.sendMessage({ action: 'jsonrpc_download', params }, (result) => {
        window.postMessage({ aria2c: 'aria2c_response', id, result });
    });
}

const messageDispatch = {
    'aria2c_status': systemStatus,
    'aria2c_download': jsonrpcDownload
};

window.addEventListener('message', (event) => {
    let { aria2c, id, params } = event.data;
    messageDispatch[aria2c]?.(id, params);
});
