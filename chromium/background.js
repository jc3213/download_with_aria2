aria2Changes.push({
    keys: ['capture_enabled'],
    action: aria2CaptureSwitch
});

chrome.contextMenus.onClicked.addListener(({menuItemId, linkUrl, srcUrl}, {id, url}) => {
    switch (menuItemId) {
        case 'aria2c_this_url':
            aria2Download(linkUrl, url, getHostname(url));
            break;
        case 'aria2c_this_image':
            aria2Download(srcUrl, url, getHostname(url));
            break;
        case 'aria2c_all_images':
            chrome.tabs.sendMessage(id, menuItemId);
            break;
    }
});

chrome.storage.sync.get(null, json => {
    aria2Storage = {...aria2Default, ...json};
    aria2ClientSetUp();
    aria2CaptureSwitch();
    aria2TaskManager();
    aria2ContextMenus();
});

async function captureOnCreated({id, finalUrl, referrer}) {
    var url = finalUrl;
    var referer = referrer === '' ? await getCurrentTabUrl() : referrer;
    var hostname = getHostname(referer);
    var priority = url.startsWith('blob') || url.startsWith('data') ? -1 : getCaptureHostname(hostname);
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
    if (aria2Storage['capture_enabled']) {
        chrome.downloads.onCreated.addListener(captureOnCreated);
        chrome.downloads.onDeterminingFilename.addListener(captureOnFilename);
        return;
    }
    chrome.downloads.onCreated.removeListener(captureOnCreated);
    chrome.downloads.onDeterminingFilename.removeListener(captureOnFilename);
}
