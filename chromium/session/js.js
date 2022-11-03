var referer = document.querySelector('#referer');
var useragent = document.querySelector('#useragent');
var batch = document.querySelector('#batch');
var entries = document.querySelector('#entries');
var savebtn = document.querySelector('#save_btn');

if (location.search === '?popup') {
    document.body.className = 'full';
    document.querySelector('input[name="out"]').disabled = true;
}
else {
    document.body.className = 'slim';
}

document.querySelector('#referer_btn').addEventListener('click', async event => {
    chrome.tabs.query({active: true, currentWindow: false}, tabs => {
        var {url} = tabs[0];
        referer.value = url;
    });
});

document.querySelector('#proxy_new').addEventListener('click', event => {
    event.target.parentNode.querySelector('input').value = aria2Store['proxy_server'];
});

document.querySelector('#submit_btn').addEventListener('click', async event => {
    var options = getOptions();
    if (batch.value === '0') {
        var urls = entries.value.match(/(https?:\/\/|ftp:\/\/|magnet:\?)[^\s\n]+/g);
        if (urls) {
            var session = urls.map(url => downloadUrl(url, options));
            await Promise.all(session);
        }
    }
    else if (batch.value === '1') {
        var json = JSON.parse(entries.value);
        await processJSON(json, options);
    }
    else if (batch.value === '2') {
        var metalink = new Blob([entries.value], {type: 'application/metalink;charset=utf-8'});
        await downloadMetalink(metalink, options);
    }
    window.close();
});

document.querySelector('#upload_btn').addEventListener('change', async event => {
    var file = event.target.files[0];
    var options = getOptions();
    if (file.name.endsWith('torrent')){
        await downloadTorrent(file, options);
    }
    else if (file.name.endsWith('json')) {
        await downloadJSON(file, options);
    }
    else {
        await downloadMetalink(file, options);
    }
    window.close();
});

document.querySelector('#extra_btn').addEventListener('click', event => {
    document.body.classList.toggle('complex');
});

function getOptions() {
    var options = {'referer': referer.value, 'user-agent': useragent.value};
    document.querySelectorAll('[name]:not(:disabled)').forEach(field => options[field.name] = field.value);
    return options;
}

async function downloadJSON(file, options) {
    var json = await readFileTypeJSON(file);
    await processJSON(json, options);
}

async function processJSON(json, extras) {
    if (!Array.isArray(json)) {
        json = [json];
    }
    var session = json.map(entry => {
        var {url, options} = entry;
        if (options) {
            options = {...extras, ...options};
        }
        else {
            options = extras;
        }
        return downloadUrl(url, options);
    });
    await Promise.all(session);
}

async function downloadUrl(url, options) {
    aria2WhenStart(url);
    return await aria2RPC.message('aria2.addUri', [[url], options]);
}

async function downloadTorrent(file, options) {
    var torrent = await readFileForAria2(file);
    aria2WhenStart(file.name);
    return await aria2RPC.message('aria2.addTorrent', [torrent]);
}

async function downloadMetalink(file, options) {
    var metalink = await readFileForAria2(file);
    aria2WhenStart(file.name);
    return await aria2RPC.message('aria2.addMetalink', [metalink, options]);
}

async function aria2StartUp() {
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
    var options = await aria2RPC.message('aria2.getGlobalOption');
    printGlobalOptions(options);
    useragent.value = aria2Store['user_agent'];
}
