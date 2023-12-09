chrome.action.onClicked.addListener(async tab => {
    var tabs = await chrome.tabs.query({currentWindow: true});
    var popup = tabs.find(tab => tab.url.includes(aria2InTab));
    if (popup) {
        return chrome.tabs.update(popup.id, {active: true});
    }
    chrome.tabs.create({active: true, url: `${aria2Popup}?open_in_tab`});
});

async function aria2DownloadPrompt(aria2c) {
    if (aria2Storage['download_prompt']) {
        var id = await aria2NewDownload(true);
        aria2Prompt[id] = aria2c;
        return;
    }
    await aria2Initial();
    var {url, json, options} = aria2c;
    if (json) {
        aria2DownloadJSON(json, options);
    }
    if (url) {
        aria2DownloadUrls(url, options);
    }
}

function aria2TaskManager() {
    var popup = aria2Storage['manager_newtab'] ? '' : aria2Popup;
    chrome.action.setPopup({popup});
}

function aria2ClientSetUp() {
    aria2RPC = new Aria2(aria2Storage['jsonrpc_uri'], aria2Storage['jsonrpc_token']);
}
