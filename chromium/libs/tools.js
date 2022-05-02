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

function getDownloadName(bittorrent, [{path, uris}]) {
    return bittorrent && bittorrent.info ? bittorrent.info.name : path ? path.slice(path.lastIndexOf('/') + 1) : uris[0].uri;
}
