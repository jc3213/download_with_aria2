chrome.action.onClicked.addListener(tab => {
    chrome.tabs.query({currentWindow: true}, tabs => {
        try {
            var {id} = tabs.find(tab => tab.url.includes(aria2Popup));
            chrome.tabs.update(id, {active: true});
        }
        catch (error) {
            chrome.tabs.create({active: true, url: aria2Popup + '?open_in_tab'});
        }
    });
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

function aria2Manager() {
    if (aria2Store['manager_newtab']) {
        chrome.action.setPopup({popup: ''});
    }
    else {
        chrome.action.setPopup({popup: aria2Popup});
    }
}

function aria2Client() {
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['jsonrpc_token']);
}
