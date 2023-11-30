chrome.action.onClicked.addListener(async tab => {
    var tabs = await chrome.tabs.query({currentWindow: true});
    var tab = tabs.find(tab => tab.url.includes(aria2InTab));
    if (tab) {
        chrome.tabs.update(tab.id, {active: true});
    }
    else {
        chrome.tabs.create({active: true, url: aria2Popup + '?open_in_tab'});
    }
});

async function aria2DownloadPrompt(aria2c) {
    if (aria2Store['download_prompt']) {
        var id = await aria2NewDownload(true);
        aria2Prompt[id] = aria2c;
    }
    else {
        await aria2Initial();
        var {url, json, options} = aria2c;
        if (json) {
            aria2DownloadJSON(json, options);
        }
        else if (url) {
            aria2DownloadUrls(url, options);
        }
    }
}

function aria2TaskManager() {
    if (aria2Store['manager_newtab']) {
        chrome.action.setPopup({popup: ''});
    }
    else {
        chrome.action.setPopup({popup: aria2Popup});
    }
}

function aria2ClientSetUp() {
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['jsonrpc_token']);
}
