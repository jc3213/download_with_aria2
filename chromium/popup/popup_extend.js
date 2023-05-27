var open_in_tab = location.search === '?open_in_tab';

if (open_in_tab) {
    document.body.classList.add('full');
}

downloadbtn.addEventListener('click', async event => {
    await aria2NewDownload();
    if (!open_in_tab) {
        close();
    }
});

optionsbtn.addEventListener('click', event => {
    chrome.runtime.openOptionsPage();
    if (!open_in_tab) {
        close();
    }
});

chrome.storage.local.get(null, json => {
    aria2Store = json;
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['jsonrpc_token']);
    aria2StartUp();
});
