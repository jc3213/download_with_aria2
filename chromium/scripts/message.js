window.addEventListener('message', (event) => {
    let message = event.data;
    let aria2c = message.aria2c;

    if (!aria2c) {
        return;
    }

    let id = message.id;

    if (aria2c === 'aria2c_status') {
        chrome.runtime.sendMessage({ action: 'addon_remote' } , (result) => {
            window.postMessage({ aria2c: 'aria2c_response', id, result });
        });
        return;
    }

    if (aria2c === 'aria2c_download') {
        let args = message.params;
        let params = [];

        for (let i = 0, l = args.length; i < l; i++) {
            let arg = args[i];

            if (typeof arg === 'string') {
                params.push({ methodName: 'aria2.addUri', params: [[arg]] });
            } else if (arg.url) {
                params.push({ methodName: 'aria2.addUri', params: [[arg.url], arg.options || {}] });
            }
        }

        chrome.runtime.sendMessage({ action: 'jsonrpc_multicall', params }, (result) => {
            window.postMessage({ aria2c: 'aria2c_response', id, result });
        });
        return;
    }
});
