var referer = document.querySelector('[name="referer"]');
var useragent = document.querySelector('[name="user-agent"]');
var batch = document.querySelector('#batch');
var entries = document.querySelector('#entries');
var fullbtn = document.querySelector('#submit_btn');
var submitbtn = document.querySelector('#submit_btn');
var countdown = document.querySelector('#countdown');

if (location.search === '?slim') {
    document.body.setAttribute('data-main', 'slim');
    runAfter = () => chrome.runtime.sendMessage('prompt', slimDownload);
}
else {
    document.body.setAttribute('data-main', 'full');
    document.querySelector('input[name="out"]').disabled = true;
    runAfter = () => useragent.value = options['user-agent'] = aria2Store['user_agent'];
}

document.addEventListener('keydown', event => {
    var {ctrlKey, altKey, keyCode} = event;
    if (altKey) {
        if (keyCode === 83) {
            event.preventDefault();
            submitbtn.click();
        }
    }
    else if (ctrlKey) {
        if (keyCode === 13) {
            event.preventDefault();
            submitbtn.click();
        }
    }
});

document.querySelector('#referer_btn').addEventListener('click', async event => {
    chrome.tabs.query({active: true, currentWindow: false}, tabs => {
        var {url} = tabs[0];
        referer.value = options['referer'] = url;
    });
});

document.querySelector('#proxy_btn').addEventListener('click', event => {
    event.target.parentNode.querySelector('input').value = options['all-proxy'] = aria2Store['proxy_server'];
});

document.querySelector('#submit_btn').addEventListener('click', async event => {
    if (batch.value === '0') {
        var urls = entries.value.match(/(https?:\/\/|ftp:\/\/|magnet:\?)[^\s\n]+/g);
        if (urls) {
            var session = urls.map(url => downloadUrl(url, options));
            await Promise.all(session);
        }
    }
    else if (batch.value === '1') {
        var json = JSON.parse(entries.value);
        await parseJSON(json, options);
    }
    else if (batch.value === '2') {
        var metalink = new Blob([entries.value], {type: 'application/metalink;charset=utf-8'});
        await downloadMetalink(metalink, options);
    }
    close();
});

document.querySelector('#upload_btn').addEventListener('change', async event => {
    var file = event.target.files[0];
    if (file.name.endsWith('torrent')){
        await downloadTorrent(file, options);
    }
    else if (file.name.endsWith('json')) {
        await downloadJSON(file, options);
    }
    else {
        await downloadMetalink(file, options);
    }
    close();
});

document.querySelector('#extra_btn').addEventListener('click', async event => {
    var {id, top, height} = await getCurrentWindow()
    chrome.windows.update(id, {top: top - 180, height: height + 360});
    document.body.setAttribute('data-main', 'compact');
    countdown.innerText = countdown.innerText * 1 + 90;
});

document.addEventListener('change', event => {
    var {name, value} = event.target;
    if (name) {
        options[name] = value;
    }
});

function slimDownload(json) {
    entries.value = json.url;
    options = {...options, ...extras};
    var extras = json.options;
    Object.keys(extras).forEach(key => {
        var entry = document.querySelector('[name="' + key + '"]');
        var value = extras[key];
        if (entry && value) {
            entry.value = value;
        }
    });
    setInterval(() => {
        countdown.innerText --;
        if (countdown.innerText === '0') {
            fullbtn.click();
        }
    }, 1000);
}

async function downloadJSON(file, options) {
    var json = await readFileTypeJSON(file);
    await parseJSON(json, options);
}

async function parseJSON(json, extras) {
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
    global = await aria2RPC.message('aria2.getGlobalOption');
    options = printGlobalOptions(global);
    runAfter();
}
