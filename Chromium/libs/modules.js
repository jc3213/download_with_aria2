function openModuleWindow(id, src) {
    var iframe = document.createElement('iframe');
    iframe.id = id;
    iframe.src = src;
    document.body.appendChild(iframe);
}
