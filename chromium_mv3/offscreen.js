const worker = new SharedWorker('/aria2-socket-worker.js', { name: 'aria2-socket-worker' });
const port = worker.port;

port.start();

port.onmessage = (event) => {
    offscreen.postMessage(event.data);
};

const offscreen = chrome.runtime.connect({ name: 'offscreen' });

offscreen.onMessage.addListener((message) => {
    port.postMessage(message);
});
