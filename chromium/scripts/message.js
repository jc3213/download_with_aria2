const messageHandlers = {
    'aria2c_status': (id) => {
        chrome.runtime.sendMessage({ action: 'system_runtime', params }, (result) => {
            window.postMessage({ aria2c: 'aria2c_response', id, result });
        });
    },
    'aria2c_download': (id, args) => {
        let params = args.filter((arg) => arg?.url)
            .map(({ url, options = {} }) => ({ name: url, task: { method: 'aria2.addUri', params: [[url], options] } }));
        chrome.runtime.sendMessage({ action: 'jsonrpc_download', params }, (result) => {
            window.postMessage({ aria2c: 'aria2c_response', id, result });
        });
    }
};

window.addEventListener('message', (event) => {
    let { aria2c, id, params } = event.data;
    messageHandlers[aria2c]?.(id, params);
});
