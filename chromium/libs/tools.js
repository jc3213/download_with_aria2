function startWorker(origin, onmessage) {
    var worker = new SharedWorker('/libs/worker.js');
    worker.port.onmessage = event => onmessage(event.data);
    worker.port.start();
    worker.port.postMessage({origin});
    return worker.port;
}

function showNotification(message = '') {
    chrome.notifications.create({
        type: 'basic',
        title: aria2Store['jsonrpc_uri'],
        iconUrl: '/icons/icon48.png',
        message
    });
}
