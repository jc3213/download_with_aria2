window.addEventListener('message', (event) => {
    let message = event.data;
    let id = message.id;
    let aria2c = message.aria2c;

    if (!aria2c) {
        return;
    }

    if (aria2c === 'aria2c_status') {
        chrome.runtime.sendMessage({ action: 'remote_status' } , (result) => {
            window.postMessage({ aria2c: 'aria2c_response', id, result });
        });
        return;
    }

    if (aria2c === 'aria2c_download') {
        remoteDownload(id, message.params);
        return;
    }
});

function remoteDownload(id, args) {
    let params = [];

    for (let i = 0, l = args.length; i < l; i++) {
        let arg = args[i];

        if (typeof arg === 'string') {
            params.push({ methodName: 'aria2.addUri', params: [[arg]] });
        } else if (arg.url) {
            params.push({ methodName: 'aria2.addUri', params: [[arg.url], arg.options || {}] });
        }
    }

    chrome.runtime.sendMessage({ action: 'remote_download', params }, (result) => {
        window.postMessage({ aria2c: 'aria2c_response', id, result });
    });
}
