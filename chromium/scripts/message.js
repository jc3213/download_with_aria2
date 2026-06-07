function systemStatus(id) {
    chrome.runtime.sendMessage({ action: 'remote_status' } , (result) => {
        window.postMessage({ aria2c: 'aria2c_response', id, result });
    });
}

function jsonrpcDownload(id, args) {
    let params = [];
    for (let i = 0, l = args.length; i < l; i++) {
        let arg = args[i];
        if (typeof args === 'string') {
            params.push({ method: 'aria2.addUri', params: [[args]] });
        } else if (args.url) {
            params.push({ method: 'aria2.addUri', params: [[args.url], args.options ?? {}] });
        }
    }
    chrome.runtime.sendMessage({ action: 'remote_download', params }, (result) => {
        window.postMessage({ aria2c: 'aria2c_response', id, result });
    });
}

const messageDispatch = {
    'aria2c_status': systemStatus,
    'aria2c_download': jsonrpcDownload
};

window.addEventListener('message', (event) => {
    let message = event.data;
    let handler = messageDispatch[message.aria2c];
    if (handler) {
        handler(message.id, message.params);
    }
});
