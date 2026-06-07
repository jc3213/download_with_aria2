function systemStatus(id) {
    chrome.runtime.sendMessage({ action: 'remote_status' } , (result) => {
        window.postMessage({ aria2c: 'aria2c_response', id, result });
    });
}

function jsonrpcDownload(id, args) {
    let params = [];
    for (let i = 0, l = args.length; i < l; i++) {
        let arg = args[i];
        if (typeof arg === 'string') {
            params.push({ method: 'aria2.addUri', params: [[arg]] });
        } else if (arg.url) {
            params.push({ method: 'aria2.addUri', params: [[arg.url], arg.options ?? {}] });
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
