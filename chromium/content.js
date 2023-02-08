postMessage({extension_name: 'Download With Aria2'});

addEventListener('message', event => {
    var {aria2c, type, message} = event.data;
    if (aria2c === 'Download With Aria2' && type === 'download') {
        chrome.runtime.sendMessage({type, message});
    }
});
