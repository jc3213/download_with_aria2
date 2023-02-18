var output = document.querySelector('#output');
var imageLET = document.querySelector('.template > .image');
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
    var json = [...document.querySelectorAll('.image :checked')].map(input => {
        var image = input.parentNode.parentNode;
        var url = image.querySelector('#src').title;
        var out = image.querySelector('#alt').title;
        if (out) {
            return {url, options: {out}};
        }
        return {url};
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
    var image = imageLET.cloneNode(true);
    var url = image.querySelector('#src');
    var img = image.querySelector('img');
    url.innerText = url.title = img.src = src;
    if (alt) {
        var path = src.slice(src.lastIndexOf('/'));
        var idx = path.indexOf('.');
        var type = idx === -1 ? '.jpg' : path.slice(idx);
        var name = image.querySelector('#alt');
        name.innerText = name.title = alt + type;
    }
    output.append(image);
}
