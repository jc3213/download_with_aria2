function aria2RPCAssist() {
    printGlobalOption();
    printFeedButton();
}

document.querySelector('#submit_btn').addEventListener('click', (event) => {
    var referer = document.querySelector('#referer').value;
    var options = {};
    document.querySelectorAll('[task], [aria2]').forEach(field => {
        var name = field.getAttribute('aria2') ?? field.getAttribute('task');
        options[name] = field.value;
    });
    document.querySelector('#entries').value.split('\n').forEach(url => {
        try {
            var session = JSON.parse(url);
            if (Array.isArray(session)) {
                if (typeof session[0] === 'string') {
                    newDownloadRequest({url: session, referer}, options);
                }
                else {
                    session.forEach(task => newDownloadRequest(referer ? {...task, referer} : task, options));
                }
            }
            else {
                newDownloadRequest(referer ? {...session, referer} : session, options);
            }
        }
        catch(error) {
            newDownloadRequest({url, referer}, options);
        }
    });
    parent.document.querySelector('[module="' + frameElement.id + '"]').classList.remove('checked');
    frameElement.style.display = 'none';
    setTimeout(() => frameElement.remove(), 500);
});

function newDownloadRequest(request, options) {
    if (/^(https?|ftp):\/\/|^magnet:\?/i.test(request.url)) {
        downloadWithAria2(request, options);
    }
    else {
        showNotification('URI is invalid');
    }
}
