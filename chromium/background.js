chrome.contextMenus.create({
    title: chrome.runtime.getManifest().name,
    id: 'downwitharia2',
    contexts: ['link']
});

chrome.contextMenus.onClicked.addListener(({linkUrl, pageUrl}) => {
    startDownload(linkUrl, getDomainFromUrl(pageUrl), {referer: pageUrl});
});

chrome.storage.local.get(null, async json => {
    aria2Store = json['jsonrpc_uri'] ? json : await fetch('/options.json').then(response => response.json());
    aria2StartUp();
    !json['jsonrpc_uri'] && chrome.storage.local.set(aria2Store);
});

chrome.storage.onChanged.addListener(changes => {
    Object.entries(changes).forEach(([key, {newValue}]) => aria2Store[key] = newValue);
    if (changes['jsonrpc_uri'] || changes['secret_token']) {
        aria2RPC.terminate();
        aria2StartUp();
    }
});

chrome.downloads.onDeterminingFilename.addListener(({id, finalUrl, referrer, filename, fileSize}) => {
    if (aria2Store['capture_mode'] === '0' || finalUrl.startsWith('blob') || finalUrl.startsWith('data')) {
        return;
    }
    chrome.tabs.query({active: true, currentWindow: true}, ([tab]) => {
        var referer = referrer && referrer !== 'about:blank' ? referrer : tab.url;
        var domain = getDomainFromUrl(referer);
        captureDownload(domain, getFileExtension(filename), fileSize) && chrome.downloads.erase({id}, () => {
            startDownload(finalUrl, domain, {referer, out: filename});
        });
    });
});

function aria2StartUp() {
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
    aria2RPC.indicator(number => {
        chrome.browserAction.setBadgeText({text: number === 0 ? '' : number + ''});
        chrome.browserAction.setBadgeBackgroundColor({color: number !== 'E' ? '#3cc' : '#c33'});
    });
}

function startDownload(url, domain, options) {
    chrome.cookies.getAll({url}, cookies => {
        options['header'] = ['Cookie:'];
        options['user-agent'] = aria2Store['user_agent'];
        options['all-proxy'] = aria2Store['proxy_include'].includes(domain) ? aria2Store['proxy_server'] : '';
        cookies.forEach(({name, value}) => options['header'][0] += ' ' + name + '=' + value + ';');
        aria2RPC.message('aria2.addUri', [[url], options]).then(result => showNotification(url));
    });
}

function captureDownload(domain, type, size) {
    return aria2Store['capture_exclude'].includes(domain) ? false :
        aria2Store['capture_reject'].includes(type) ? false :
        aria2Store['capture_mode'] === '2' ? true :
        aria2Store['capture_include'].includes(domain) ? true :
        aria2Store['capture_resolve'].includes(type) ? true :
        aria2Store['capture_size'] > 0 && size >= aria2Store['capture_size'] ? true : false;
}
