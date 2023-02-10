postMessage({extension_name: 'Download With Aria2'});

addEventListener('message', event => {
    var {aria2c, download} = event.data;
    if (aria2c === 'Download With Aria2' && download !== undefined) {
        chrome.runtime.sendMessage({action: 'external_download', params: message});
    }
});
