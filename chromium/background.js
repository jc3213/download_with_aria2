aria2Changes.push({
    keys: ['capture_enabled'],
    action: aria2CaptureSwitch
});

chrome.contextMenus.onClicked.addListener(({menuItemId, linkUrl, srcUrl}, {id, url}) => {
    if (menuItemId === 'aria2c_this_url') {
        aria2Download(linkUrl, url, getHostname(url));
    }
    else if (menuItemId === 'aria2c_this_image') {
        aria2Download(srcUrl, url, getHostname(url));
    }
    else if (menuItemId === 'aria2c_all_images') {
        chrome.tabs.sendMessage(id, menuItemId);
    }
});

chrome.storage.sync.get(null, json => {
    aria2Store = {...aria2Default, ...json};
    aria2ClientSetUp();
    aria2CaptureSwitch();
    aria2TaskManager();
    aria2ContextMenus();
});

async function captureOnCreated({id, finalUrl, referrer}) {
    var url = finalUrl;
    var referer = referrer === '' ? await getCurrentTabUrl() : referrer;
    var hostname = getHostname(referer);
    if (url.startsWith('blob') || url.startsWith('data')) {
        var priority = -1;
    }
    else {
        priority = getCaptureHostname(hostname);
    }
    aria2Monitor[id] = {url, referer, hostname, priority};
}

async function captureOnFilename({id, filename, fileSize}) {
    var {url, referer, hostname, priority} = aria2Monitor[id];
    if (priority < 0) {
        return;
    }
    priority += getCaptureFileData(fileSize, getFileExtension(filename));
    if (priority > 0) {
        chrome.downloads.erase({id});
        aria2Monitor[id].priority = priority;
        aria2Download(url, referer, hostname, {out: filename});
    }
}

function aria2CaptureSwitch() {
    if (aria2Store['capture_enabled']) {
        chrome.downloads.onCreated.addListener(captureOnCreated);
        chrome.downloads.onDeterminingFilename.addListener(captureOnFilename);
    }
    else {
        chrome.downloads.onCreated.removeListener(captureOnCreated);
        chrome.downloads.onDeterminingFilename.removeListener(captureOnFilename);
    }
}
