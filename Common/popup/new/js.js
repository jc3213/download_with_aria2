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
    document.querySelector('#entries').value.split('\n').forEach(result => {
        try {
            var session = JSON.parse(result);
            if (Array.isArray(session)) {
                if (typeof session[0] === 'string') {
                    downloadWithAria2({url: session, referer}, options);
                }
                else {
                    session.forEach(task => downloadWithAria2(referer ? {...task, referer} : task, options));
                }
            }
            else {
                downloadWithAria2(referer ? {...session, referer} : session, options);
            }
        }
        catch(error) {
            result.split('\n').forEach(url => downloadWithAria2({url, referer}, options));
        }
    });
    parent.document.querySelector('[module="' + frameElement.id + '"]').classList.remove('checked');
    frameElement.style.display = 'none';
    setTimeout(() => frameElement.remove(), 500);
});
