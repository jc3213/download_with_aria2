function messgeChannel(id, message) {
    chrome.runtime.sendMessage(message, (result) => {
        window.postMessage({ aria2c: 'aria2c_response', id, result });
    });
}

const messageHandlers = {
    'aria2c_status': (id) => messgeChannel(id, { action: 'system_runtime' }),
    'aria2c_download': (id, args) => {
        let params = args.filter((arg) => arg?.url)
            .map(({ url, options = {} }) => ({ name: url, task: { method: 'aria2.addUri', params: [[url], options] } }));
        messgeChannel(id, { action: 'jsonrpc_download', params });
    }
};

window.addEventListener('message', (event) => {
    let { aria2c, id, params } = event.data;
    messageHandlers[aria2c]?.(id, params);
});
