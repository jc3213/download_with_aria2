const worker = new SharedWorker('shared.js', { name: 'aria2-socket-worker' });
const port = worker.port;

port.start();

port.onmessage = (event) => {
    offscreen.postMessage(event.data);
};

const offscreen = chrome.runtime.connect({ name: 'offscreen' });

offscreen.onMessage.addListener((message) => {
    port.postMessage(message);
});
