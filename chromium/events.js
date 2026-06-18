chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId === 0) {
        aria2Inspect.set(details.tabId, { images: [], url: details.url });
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    let url = changeInfo.url;

    if (!url) {
        return;
    }

    let inspect = aria2Inspect.get(tabId);

    if (!inspect || inspect.url !== url) {
        aria2Inspect.set(tabId, { images: [], url });
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    aria2Inspect.delete(tabId);
});

chrome.webRequest.onBeforeSendHeaders.addListener((details) => {
    let tabId = details.tabId;
    let url = details.url;
    let tab = aria2Inspect.get(tabId);

    if (!tab) {
        tab = { images: [], url };
        aria2Inspect.set(tabId, tab);
    }

    if (details.type === 'image') {
        let idx = url.search(/[?#@]/);
        let img = idx === -1 ? url : url.substring(0, idx);

        if (img in tab) {
            return;
        }

        tab[img] = url;
        tab.images.push(url);
    } else {
        tab[url] = details.requestHeaders;
    }
}, { urls: systemURLs, types: ['main_frame', 'sub_frame', 'image', 'other'] }, systemHeaders);

chrome.action.onClicked.addListener(() => {
    chrome.tabs.query({ url: addonManager, currentWindow: true }, (tabs) => {
        let tab = tabs[0];
        if (tab) {
            chrome.tabs.update(tab.id, { active: true });
        } else {
            chrome.tabs.create({ url: addonManager, active: true });
        }
    });
});

chrome.commands.onCommand.addListener((command) => {
    if (command === 'open_options') {
        chrome.runtime.openOptionsPage();
        return;
    }

    if (command === 'open_new_download') {
        openPopupWindow(addonDownload, 454);
        return;
    }

    if (command === 'toggle_capture') {
        ommandToggleHost('capture_hosts', captureHosts);
        return;
    }

    if (command === 'toggle_headers') {
        ommandToggleHost('headers_hosts', headersHosts);
        return;
    }

    if (command === 'toggle_proxy') {
        ommandToggleHost('proxy_hosts', proxyHosts);
        return;
    }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    let id = info.menuItemId;

    if (id === 'ctxmenu_thisurl') {
        downloadHandler(info.linkUrl, tab.url, null, null, tab.id);
        return;
    }

    if (id === 'ctxmenu_thisimage') {
        downloadHandler(info.srcUrl, tab.url, null, null, tab.id);
        return;
    }

    if (id === 'ctxmenu_allimages') {
        openPopupWindow(addonImages + '?' + tab.id, 680);
        return;
    }
});

function popupMenuEnabler(json) {
    if (json['manager_newtab']) {
        chrome.action.setPopup({ popup: '' });
    } else {
        chrome.action.setPopup({ popup: '/pages/popup/popup.html?toolbar' });
    }
}

function contextMenusEnabler(json) {
    chrome.contextMenus.removeAll();

    if (!json['ctxmenu_enabled']) {
        return;
    }

    let menuId;

    if (json['ctxmenu_cascade']) {
        menuId = 'extension_name';
        contextMenusAdd(menuId, ['link', 'image', 'page']);
    }

    if (json['ctxmenu_thisurl']) {
        contextMenusAdd('ctxmenu_thisurl', ['link'], menuId);
    }

    if (json['ctxmenu_thisimage']) {
        contextMenusAdd('ctxmenu_thisimage', ['image'], menuId);
    }

    if (json['ctxmenu_allimages']) {
        contextMenusAdd('ctxmenu_allimages', ['page'], menuId);
    }
}

function contextMenusAdd(id, contexts, parentId) {
    chrome.contextMenus.create({
        id,
        title: chrome.i18n.getMessage(id),
        contexts,
        parentId,
        documentUrlPatterns: ['http://*/*', 'https://*/*']
    });
}

function commandToggleHost(id, rules) {
    chrome.tabs.query({ url: systemURLs, active: true, currentWindow: true }, (tabs) => {
        let tab = tabs[0];
        if (!tab) {
            return;
        }
        let host = getHostname(tab.url);
        let options;
        if (rules.has(host)) {
            rules.delete(host);
            options = 'match_remove';
        } else {
            rules.add(host);
            options = 'match_add';
        }
        let value = aria2Storage[id] = Array.from(rules);
        let title = chrome.i18n.getMessage('options_' + id.substring(0, id.indexOf('_')));
        let message = chrome.i18n.getMessage(options, [host, chrome.i18n.getMessage(id)]);
        chrome.storage.sync.set({ [id]: value });
        chrome.runtime.sendMessage({ options, params: { id, host } }, () => chrome.runtime.lastError);
        chrome.notifications.create({ title, message, type: 'basic', iconUrl: '/icons/48.png' });
    });
}

chrome.runtime.onMessage.addListener((message, sender, response) => {
    let action = message.action;
    let params = message.params;

    if (action === 'options_runtime') {
        response({ system: systemManifest, storage: aria2Storage });
        return;
    }

    if (action === 'options_jsonrpc') {
        response({ options: aria2Config, version: aria2Version });
        return;
    }

    if (action === 'update_storage') {
        storageDispatch(params);
        chrome.storage.sync.set(params, response);
        return true;
    }

    if (action === 'update_jsonrpc') {
        for (let i = 0, l = RawKeys.length; i < l; i++) {
            let key = RawKeys[i];
            aria2Config[key] = params[key];
        }
        for (let i = 0, l = SizeKeys.length; i < l; i++) {
            let key = SizeKeys[i];
            aria2Config[key] = params[key];
        }
        aria2RPC.call('aria2.changeGlobalOption', [params]).then(response).catch(response);
        return true;
    }

    if (action === 'popup_runtime') {
        response({ storage: aria2Storage, options: aria2Config, version: aria2Version });
        return;
    }

    if (action === 'popup_queues') {
        aria2Storage['manager_filters'] = params;
        chrome.storage.sync.set({ 'manager_filters': params }, response);
        return true;
    }

    if (action === 'images_runtime') {
        let images = aria2Inspect.get(id)?.images || [];
        response({ system: systemManifest, headers: systemHeaders, images, storage: aria2Storage, options: aria2Config });
        return true;
    }

    if (action === 'newdld_window') {
        openPopupWindow(addonDownload, 454);
        return;
    }

    if (action === 'newdld_runtime') {
        response({ storage: aria2Storage, options: aria2Config });
        return;
    }

    if (action === 'remote_status') {
        response({ system: systemManifest, options: aria2Config });
        return;
    }

    if (action === 'remote_download') {
        aria2RPC.multicall(params).then(response).catch(response);
        return true;
    }
});
