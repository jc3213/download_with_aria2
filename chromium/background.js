let easyDefault = {
    mode: 'autopac',
    preset: null,
    network: false,
    action: 'none',
    handler: [ 'net::ERR_CONNECTION_REFUSED', 'net::ERR_CONNECTION_RESET', 'net::ERR_CONNECTION_TIMED_OUT', 'net::ERR_NAME_NOT_RESOLVED' ],
    proxies: [],
    exclude: []
};

if (chrome.runtime.getManifest().manifest_version === 3) {
    importScripts('libs/easyproxy.js');
    setInterval(chrome.runtime.getPlatformInfo, 28000);
}

let easyStorage = {};
let easyHandler;
let easyNetwork;
let easyAction;
let easyPreset;
let easyMatch = {};
let easyTempo = {};
let easyExclude = new EasyProxy('DIRECT');
let easyMode;
let easyInspect = {};

let cacheRules = {};
let cacheCounts = {};
let cacheExclude = {};

function storageUpdated(response, json) {
    let invalid = [];
    let removed = []
    for (let key of Object.keys(json)) {
        if (key in easyDefault) {
            continue;
        }
        if (!json.proxies.includes(key)) {
            delete json[key];
            invalid.push(key);
            continue;
        }
        if (easyStorage.proxies.includes(key)) {
            easyMatch[key].new(json[key]);
        } else {
            easyMatch[key] = new EasyProxy(key);
            easyTempo[key] = new EasyProxy(key);
        }
    }
    for (let proxy of easyStorage.proxies) {
        if (!json[proxy]) {
            delete easyMatch[proxy];
            delete easyTempo[proxy];
            removed.push(proxy);
        }
    }
    EasyProxy.delete(removed);
    easyStorage = json;
    storageDispatch();
    cacheCounts = {};
    cacheExclude = {};
    chrome.storage.local.remove([...invalid, ...removed]);
    chrome.storage.local.set(json, response);
}

function proxyQuery(response, tabId) {
    let match = {};
    let tempo = {};
    let exclude = easyExclude.route;
    let { proxies, mode, preset } = easyStorage;
    let inspect = easyInspect[tabId];
    if (!inspect) {
        response({ match, tempo, exclude, rules: [], hosts: [], error: [], proxies, mode, preset });
        return;
    }
    for (let proxy of proxies) {
        match = { ...match, ...easyMatch[proxy].route };
        tempo = { ...tempo, ...easyTempo[proxy].route };
    }
    let { rules, hosts, error } = inspect;
    response({ match, tempo, exclude, rules: [...rules], hosts: [...hosts], error: [...error], proxies, mode, preset });
}

function proxySubmit(response, { changes, tabId }) {
    for (let { type, proxy, rule, action } of changes) {
        let route = type === 'match' ? easyMatch[proxy] : type === 'tempo' ? easyTempo[proxy] : easyExclude;
        action === 'add' ? route.add(rule) : route.delete(rule);
    }
    for (let proxy of easyStorage.proxies) {
        easyStorage[proxy] = easyMatch[proxy].data;
    }
    easyStorage['exclude'] = easyExclude.data;
    cacheCounts = {};
    cacheExclude = {};
    proxyDispatch();
    chrome.storage.local.set(easyStorage, response);
    chrome.tabs.reload(tabId);
}

function proxyPurge(response, tabId) {
    for (let proxy of easyStorage.proxies) {
        easyTempo[proxy].new();
    }
    cacheCounts = {};
    proxyDispatch();
    chrome.tabs.reload(tabId);
}

function modeUpdated(response, { tabId, mode }) {
    easyMode = easyStorage.mode = mode;
    proxyDispatch();
    chrome.storage.local.set(easyStorage, response);
    chrome.tabs.reload(tabId);
}

const messageDispatch = {
    'storage_query': (response) => response(easyStorage),
    'storage_update': storageUpdated,
    'pacscript_query': (response, params) => response(easyMatch[params].pacScript),
    'manager_query': proxyQuery,
    'manager_update': proxySubmit,
    'manager_purge': proxyPurge,
    'easyproxy_mode': modeUpdated
};

chrome.runtime.onMessage.addListener(({ action, params }, sender, response) => {
    messageDispatch[action]?.(response, params);
    return true;
});

function proxyFirefox() {
    let value;
    if (easyMode === 'autopac') {
        value = { proxyType: 'autoConfig', autoConfigUrl: 'data:,' + EasyProxy.pacScript };
    } else if (easyMode === 'direct') {
        value = { proxyType: 'none' };
    } else {
        let proxy = easyPreset ?? easyStorage.proxies[0];
        let [scheme, url] = proxy.split(' ');
        value = { proxyType: 'manual', passthrough: 'localhost, 127.0.0.1' };
        if (scheme === 'HTTP') {
            value.http = 'http://' + url;
        } else if (scheme === 'HTTPS') {
            value.ssl = 'https://' + url;
        } else {
            value.socks = 'socks://' + url;
            value.socksVersion = scheme === 'SOCKS' ? 4 : 5;
        }
    }
    browser.proxy.settings.set({ value });
}
function proxyChromium() {
    let value;
    if (easyMode === 'autopac') {
        value = { mode: 'pac_script', pacScript: { data: EasyProxy.pacScript } };
    } else if (easyMode === 'direct') {
        value = { mode: 'direct' };
    } else {
        let proxy = easyPreset ?? easyStorage.proxies[0];
        let [scheme, host, port] = proxy.split(/[\s:]/);
        let singleProxy = { scheme: scheme.toLowerCase(), host, port: port | 0 };
        value = { mode: 'fixed_servers', rules: { singleProxy, bypassList: ['localhost', '127.0.0.1'] } };
    }
    chrome.proxy.settings.set({ value });
}
const proxyDispatch = typeof browser !== 'undefined' ? proxyFirefox : proxyChromium;

chrome.action ??= chrome.browserAction;
chrome.action.setBadgeBackgroundColor({ color: '#2940D9' });

chrome.tabs.onRemoved.addListener((tabId) => {
    delete easyInspect[tabId];
});

chrome.tabs.onUpdated.addListener((tabId, { status }) => {
    let inspect = easyInspect[tabId] ??= { rules: new Set(), hosts: new Set(), error: new Set(), index: 0 };
    if (status == 'loading' && inspect.ok) {
        delete easyInspect[tabId];
    } else if (status === 'complete') {
        inspect.ok = true;
    }
});

function inspectRequest(action, tabId, url) {
    let host = url.split('/')[2];
    if (host.includes('@')) {
        host = host.substring(host.indexOf('@') + 1);
    }
    if (host.includes(':')) {
        host = host.substring(0, host.indexOf(':'));
    }
    let rule = cacheRules[host] ??= EasyProxy.make(host);
    chrome.runtime.sendMessage({ action, params: { tabId, rule, host } });
    return { host, rule };
}

chrome.webRequest.onBeforeRequest.addListener(({ tabId, type, url }) => {
    if (tabId === -1) {
        return;
    }
    let inspect = easyInspect[tabId] ??= { rules: new Set(), hosts: new Set(), error: new Set(), index: 0 };
    let { host, rule } = inspectRequest('network_update', tabId, url);
    inspect.rules.add(rule);
    inspect.hosts.add(host);
    if (!easyNetwork || easyMode === 'direct') {
        return;
    }
    let match = cacheCounts[host] ??= EasyProxy.test(host);
    if (match) {
        chrome.action.setBadgeText({ tabId, text: String(++inspect.index) });
    }
}, { urls: ['http://*/*', 'https://*/*'] });

chrome.webRequest.onErrorOccurred.addListener(({ tabId, error, url }) => {
    if (!easyHandler.has(error) || !easyPreset) {
        return;
    }
    let { host, rule } = inspectRequest('network_error', tabId, url);
    if (easyAction === 'none') {
        let { error } = easyInspect[tabId];
        error.add(rule);
        error.add(host);
        return;
    }
    let exclude = cacheExclude[host] ??= easyExclude.test(host);
    if (exclude) {
        return;
    }
    if (easyAction === 'match') {
        let proxy = easyMatch[easyPreset];
        proxy.add(host);
        chrome.storage.local.set({ [easyPreset]: proxy.data });
    } else {
        let proxy = easyTempo[easyPreset];
        proxy.add(host);
    }
    proxyDispatch();
    chrome.runtime.sendMessage({ action: 'network_' + easyAction, params: { tabId, host } });
}, { urls: ['http://*/*', 'https://*/*'] });

function storageDispatch() {
    easyNetwork = easyStorage.network;
    easyHandler = new Set(easyStorage.handler);
    easyAction = easyStorage.action;
    easyPreset = easyStorage.preset;
    easyMode = easyStorage.mode;
    easyExclude.new(easyStorage.exclude);
    proxyDispatch();
}

chrome.storage.local.get(null, async (json) => {
    easyStorage = {...easyDefault, ...json};
    for (let proxy of easyStorage.proxies) {
        easyMatch[proxy] = new EasyProxy(proxy);
        easyTempo[proxy] = new EasyProxy(proxy);
        easyMatch[proxy].new(easyStorage[proxy]);
    }
    storageDispatch();
});
