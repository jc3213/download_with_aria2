var viewer = document.querySelector('#viewer');
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

submitbtn.addEventListener('click', async event => {
    var json = [...document.querySelectorAll('.checked')].map(img => {
        var {src, alt} = img;
        var options = {...aria2Global};
        if (alt) {
            options['out'] = alt;
        }
        return {url: src, options};
    });
    if (json.length !== 0) {
        await aria2DownloadJSON(json);
    }
    close();
});

function aria2StartUp() {
    chrome.runtime.sendMessage({action: 'internal_images'}, images => {
        var {result, options} = images;
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
        var ix = path.indexOf('.');
        var ext = ix === -1 ? '.jpg' : path.slice(ix);
        var ax = ext.indexOf('@');
        if (ax !== -1) {
            ext = ext.slice(0, ax);
        }
        img.alt = alt + ext;
    }
    img.addEventListener('load', event => {
        var {offsetWidth, offsetHeight} = img;
        img.title = offsetWidth + 'x' + offsetHeight;
    });
    img.addEventListener('click', event => {
        img.className = img.className === 'checked' ? '' : 'checked';
    });
    viewer.append(img);
}
