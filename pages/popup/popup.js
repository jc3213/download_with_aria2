var easyMatch = {};
var easyMatchTempo = {};
var easyProxy;
var easyTab;
var easyId = 0;
var easyHosts = [];
var easyList = {};
var changes = {};
var restore = {};
var checkboxes = [];
var manager = document.body.classList;
var [output, proxies, submitBtn] = document.querySelectorAll('#output, #proxy, [data-bid="submit_btn"]');
var hostLET = document.querySelector('.template > .host');

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        submitBtn.click();
    }
});

document.addEventListener('click', (event) => {
    switch (event.target.dataset.bid) {
        case 'expand_btn': 
            manager.toggle('expand');
            break;
        case 'submit_btn':
            proxySubmit();
            break;
        case 'tempo_btn':
            proxyTempo(event.ctrlKey && event.altKey);
            break;
        case 'options_btn':
            chrome.runtime.openOptionsPage();
            break;
    }
});

function proxySubmit() {
    var manage = proxyChange('match', easyStorage, easyMatch);
    if (manage) {
        proxyStatusUpdate('manager_submit', {storage: easyStorage});
    }
}

function proxyTempo(remove) {
    var manage = proxyChange('tempo', easyTempo, easyMatchTempo);
    if (manage) {
        proxyStatusUpdate('manager_tempo', {tempo: easyTempo});
    }
}

function proxyTempoPurge(proxy) {
    easyMatchTempo = {};
    easyTempo = {};
    easyHosts.forEach((match) => {
        match.parentNode.classList.remove('tempo');
        match.checked = easyMatch[match.value] === proxy || easyMatchTempo[match.value] === proxy ? true : false;
    });
    proxyStatusUpdate('manager_purge');
}

function proxyStatusUpdate(action, params = {}) {
    easyList = {};
    params.tabId = easyTab;
    chrome.runtime.sendMessage({action, params});
}

function proxyChange(type, storage, logs) {
    var proxy = proxies.value;
    var include = [];
    var exclude = [];
    var matches = storage[proxy] || [];
    checkboxes.forEach((check) => {
        var {value, checked} = check;
        var status = check.parentNode.classList[2];
        if (status && status !== type) {
            check.checked = restore[value];
            return;
        }
        if (checked && !logs[value]) {
            logs[value] = proxy;
            include.push(value);
            matches.push(value);
            return check.parentNode.classList.add(type);
        }
        if (!checked && logs[value]) {
            delete logs[value];
            matches.splice(matches.indexOf(value), 1);
            exclude.push(value);
            return check.parentNode.classList.remove(type);
        }
    });
    changes = {};
    restore = {};
    checkboxes = [];
    storage[proxy] = matches;
    return include.length !== 0 || exclude.length !== 0;
}

document.getElementById('output').addEventListener('change', (event) => {
    var entry = event.target;
    var value = entry.value;
    var checked = entry.checked;
    if (changes[value] === undefined) {
        restore[value] = !checked;
        checkboxes.push(entry);
    }
    changes[value] = checked;
});

document.getElementById('expand').addEventListener('change', (event) => {
    easyProxy = event.target.value;
    easyHosts.forEach((match) => {
        var host = match.value;
        match.checked = easyMatch[host] === proxy || easyMatchTempo[host] === proxy;
        match.disabled = easyMatch[host] && easyMatch[host] !== proxy || easyMatchTempo[host] && easyMatchTempo[host] !== proxy;
    });
});

chrome.runtime.onMessage.addListener(({action, params}) => {
    switch (action) {
        case 'manager_update':
            output.innerHTML = '';
        case 'manager_sync':
            easyMatchUpdate(params);
            break;
    }
});

function easyMatchUpdate({tabId, host, match}) {
    if (easyProxy && tabId === easyTab) {
        easyMatchPattern(host, 'hostname');
        easyMatchPattern(match, 'wildcard');
        manager.remove('hibernate');
    }
}

chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
    easyTab = tabs[0].id;
    chrome.runtime.sendMessage({action: 'manager_initial', params: {tabId: easyTab}}, easyMatchInitial);
});

function easyMatchInitial({storage, tempo, result}) {
    easyStorage = storage;
    easyTempo = tempo;
    storage.proxies.forEach((proxy) => {
        if (!storage.pacs[proxy]) {
            easyProxy ??= proxy;
            easyProxyCeate(proxy);
        }
    });
    if (!easyProxy || !result) {
        return manager.add('hibernate');
    }
    result.host.forEach((value) => easyMatchPattern(value, 'hostname'));
    result.match.forEach((value) => easyMatchPattern(value, 'wildcard'));
}

function easyProxyCeate(proxy) {
    var menu = document.createElement('option');
    menu.textContent = menu.title = menu.value = proxy;
    proxies.append(menu);
    easyStorage[proxy].forEach((match) => easyMatch[match] = proxy);
    easyTempo[proxy]?.forEach((match) => easyMatchTempo[match] = proxy);
}

function easyMatchPattern(value, type) {
    if (easyList[value]) {
        return;
    }
    var host = hostLET.cloneNode(true);
    host.classList.add(type);
    var [entry, label] = host.querySelectorAll('input, label');
    entry.id = 'easyproxy_' + easyId;
    label.setAttribute('for', 'easyproxy_' + easyId);
    host.title = label.textContent = entry.value = value;
    if (easyMatch[value]) {
        host.classList.add('match');
    }
    if (easyMatchTempo[value]) {
        host.classList.add('tempo');
    }
    if (easyMatch[value] === easyProxy || easyMatchTempo[value] === easyProxy) {
        entry.checked = true;
    }
    easyHosts.push(entry);
    easyId ++;
    output.append(host);
    easyList[value] = true;
}
