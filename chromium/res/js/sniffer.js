var preview = document.querySelector('#preview');
var submitbtn = document.querySelector('#submit_btn');

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

document.querySelector('#submit_btn').addEventListener('click', async event => {
    var json = [...document.querySelectorAll('img.checked')].map(img => {
        var {src, alt, title} = img;
        var url = src;
        var options = {...aria2Global};
        if (alt) {
            options['out'] = alt;
        }
        return {url, options};
    });
    if (json.length !== 0) {
        await aria2DownloadJSON(json);
    }
    close();
});

function aria2StartUp() {
    chrome.runtime.sendMessage({action: 'internal_sniffer'}, sniffer => {
        var {result, options} = sniffer;
        result.forEach(getPreview);
        aria2Global = options;
    });
}

function getPreview({src, alt, title}) {
    if (!src) {
        return;
    }
    var img = document.createElement('img');
    img.src = src;
    if (alt) {
        var path = src.slice(src.lastIndexOf('/'));
        var idx = path.indexOf('.');
        var type = idx === -1 ? '.jpg' : path.slice(idx);
        img.alt = alt + type;
    }
    img.addEventListener('load', event => {
        img.title = img.offsetWidth + 'x' + img.offsetHeight;
    });
    img.addEventListener('click', event => {
        img.className = img.className === 'checked' ? '' : 'checked';
    });
    preview.append(img);
}
