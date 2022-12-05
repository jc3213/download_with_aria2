var batch = document.querySelector('#batch');
var entries = document.querySelector('#entries');
var submitbtn = document.querySelector('#submit_btn');
var countdown = document.querySelector('#countdown');

if (location.search === '?slim') {
    document.body.className = 'slim';
}
else {
    document.body.className = 'full';
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
        event.target.previousElementSibling.value = aria2Global['referer'] = url;
    });
});

document.querySelector('#proxy_btn').addEventListener('click', event => {
    event.target.previousElementSibling.value = aria2Global['all-proxy'] = aria2Store['proxy_server'];
});

document.querySelector('#submit_btn').addEventListener('click', async event => {
    if (batch.value === '0') {
        var urls = entries.value.match(/(https?:\/\/|ftp:\/\/|magnet:\?)[^\s\n]+/g);
        if (urls) {
            await downloadUrls(urls, aria2Global);
        }
    }
    else if (batch.value === '1') {
        var json = JSON.parse(entries.value);
        await downloadJSON(json, aria2Global);
    }
    else if (batch.value === '2') {
        var metalink = new Blob([entries.value], {type: 'application/metalink;charset=utf-8'});
        await downloadMetalink(metalink, aria2Global);
    }
    //close();
});

document.querySelector('#upload_btn').addEventListener('change', async event => {
    var file = event.target.files[0];
    if (file.name.endsWith('torrent')){
        await downloadTorrent(file, aria2Global);
    }
    else if (file.name.endsWith('json')) {
        await parseJSON(file, aria2Global);
    }
    else {
        await downloadMetalink(file, aria2Global);
    }
    close();
});

document.querySelector('#extra_btn').addEventListener('click', async event => {
    var {id, top, height} = await getCurrentWindow();
    chrome.windows.update(id, {top: top - 192, height: height + 384});
    document.body.className = 'compact';
    countdown.innerText = countdown.innerText * 1 + 90;
});

document.addEventListener('change', event => {
    var {name, value} = event.target;
    if (name) {
        aria2Global[name] = value;
    }
});

function slimModeInit() {
    chrome.runtime.sendMessage({type: 'prompt'}, response => {
        var {url, options} = response;
        if (Array.isArray(url)) {
            entries.value = url.join('\n');
        }
        else {
            entries.value = url;
        }
        if (options !== undefined) {
            var extra = document.querySelectorAll('[name]').printOptions(options);
            aria2Global = {...aria2Global, ...extra};
        }
        setInterval(() => {
            countdown.innerText --;
            if (countdown.innerText === '0') {
                submitbtn.click();
            }
        }, 1000);
    });
}

function downloadUrls(urls) {
    var sessions = urls.map(url => param = {
        method: 'aria2.addUri',
        params: [[url], aria2Global]
    });
    aria2WhenStart(urls.join());
    return aria2RPC.batch(sessions);
}

function downloadJSON(json) {
    if (!Array.isArray(json)) {
        json = [json];
    }
    var urls = [];
    var sessions = json.map(entry => {
        var {url, options} = entry;
        urls.push(url);
        if (options !== undefined) {
            options = {...aria2Global, ...options};
        }
        else {
            options = aria2Global;
        }
        return {method: 'aria2.addUri', params: [[url], options]};
    });
    aria2WhenStart(urls.join());
    return aria2RPC.batch(sessions);
}

async function parseJSON(file) {
    var json = await readFileTypeJSON(file);
    return downloadJSON(json);
}

async function downloadTorrent(file) {
    var torrent = await readFileForAria2(file);
    aria2WhenStart(file.name);
    return aria2RPC.call('aria2.addTorrent', [torrent]);
}

async function downloadMetalink(file) {
    var metalink = await readFileForAria2(file);
    aria2WhenStart(file.name);
    return aria2RPC.call('aria2.addMetalink', [metalink, aria2Global]);
}

async function aria2StartUp() {
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
    var global = await aria2RPC.call('aria2.getGlobalOption');
    global['user-agent'] = aria2Store['user_agent']
    aria2Global = document.querySelectorAll('[name]').printOptions(global);
    if (location.search === '?slim') {
        slimModeInit();
    }
}
