var easyDefault = {
    pacs: {},
    proxies: []
};
var easyStorage = {};
var easyPAC = '';
var easyPACX = '';
var easyPort;
var easyMatch = {};
var easyTempo = {};
var easyTempoLog = {};
var easyMain = chrome.runtime.getManifest().manifest_version;

chrome.runtime.onMessage.addListener(({action, params}, sender, response) => {
    switch (action) {
        case 'options_initial':
            easyOptionsInitial(response);
            break;
        case 'options_onchange':
            easyMatchChanged(params, response);
            break;
        case 'manager_initial':
            easyMatchInitial(params, response);
            break;
        case 'manager_submit':
            easyMatchSubmit(params);
            break;
        case 'manager_tempo':
            easyTempoUpdate(params);
            break;
        case 'manager_purge':
            easyTempoPurge(params);
            break;
    }
});

function easyOptionsInitial(response) {
    response({
        storage: {...easyDefault, ...easyStorage},
        pac_script: easyPAC,
    });
}

function easyMatchInitial(params, response) {
    response({
        storage: {...easyDefault, ...easyStorage},
        tempo: easyTempo,
        result: easyMatch[params.tabId]
    });
}

function easyMatchSubmit({storage, tabId}) {
    easyStorageUpdated(storage);
    easyReloadTab(tabId);
}

function easyMatchChanged({storage, removed = []}, response) {
    easyStorageUpdated(storage, response);
    chrome.storage.local.remove(removed);
}

function easyStorageUpdated(json, callback) {
    easyStorage = json;
    pacScriptConverter();
    chrome.storage.local.set(json);
    callback({storage: {...easyDefault, ...easyStorage}, pac_script: easyPAC});
}

function easyTempoUpdate({tempo, tabId}) {
    easyTempo = tempo;
    pacScriptConverter();
    easyReloadTab(tabId);
}

function easyTempoPurge({tabId}) {
    easyTempo = {};
    easyTempoLog = {};
    pacScriptConverter();
    easyReloadTab(tabId);
}

function easyReloadTab(id) {
    chrome.tabs.update(id, {url: easyMatch[id].url});
}

chrome.webNavigation.onBeforeNavigate.addListener(({tabId, url, frameId}) => {
    if (frameId === 0) {
        var host = new URL(url).hostname;
        var match = MatchPattern.host(host);
        easyMatch[tabId] = { host: [host], match: [match], cache: { [host]: true, [match]: true }, url };
        easyMatchSync('manager_update', tabId, host, match);
    }
});

chrome.webRequest.onBeforeRequest.addListener(({tabId, url}) => {
    var host = new URL(url).hostname;
    var match = MatchPattern.host(host);
    var matched = easyMatch[tabId];
    if (!match || !matched) {
        return;
    }
    if (!matched.cache[host]) {
        matched.host.push(host);
        matched.cache[host] = true;
    }
    if (!matched.cache[match]) {
        matched.match.push(match);
        matched.cache[match] = true;
    }
    easyMatchSync('manager_sync', tabId, host, match);
}, {urls: ['http://*/*', 'https://*/*']});

function easyMatchSync(action, tabId, host, match) {
    chrome.runtime.sendMessage({action, params: {tabId, host, match}});
}

chrome.tabs.onRemoved.addListener(({tabId}) => {
    delete easyMatch[tabId];
});

chrome.storage.local.get(null, (json) => {
    easyStorage = {...easyDefault, ...json};
    pacScriptConverter();
    if (easyMain === 3) {
        persistentModeEnabled();
    }
});

function setEasyProxy(data) {
    chrome.proxy.settings.set({
        value: {
            mode: "pac_script",
            pacScript: {data}
        },
        scope: 'regular'
    });
}

function pacScriptConverter() {
    var pac_script = '';
    var tempo = '';
    easyStorage.proxies.forEach((proxy) => {
        if (easyStorage.pacs[proxy]) {
            pac_script += '\n    ' + easyStorage[proxy].replace(/^[^{]*{/, '').replace(/return\s+"DIRECT.*$/, '').trim();
            return;
        }
        pac_script += convertRegexp(proxy, easyStorage[proxy]);
        tempo += convertRegexp(proxy, easyTempo[proxy] ?? []);
    });
    easyPAC = convertPacScript(pac_script);
    easyPACX = convertPacScript(pac_script + tempo);
    setEasyProxy(easyPACX);
}

function convertRegexp(proxy, matches) {
    return matches.length === 0 ? '' : '\n    if (/^(' + matches.join('|').replace(/\./g, '\\.').replace(/\\?\.?\*\\?\.?/g, '.*') + ')$/i.test(host)) {\n        return "' + proxy + '";\n    }';
}

function convertPacScript(pac_script) {
    return 'function FindProxyForURL(url, host) {' + pac_script + '\n    return "DIRECT";\n}';
}
