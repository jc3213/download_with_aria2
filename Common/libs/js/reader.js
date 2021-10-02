function readLocalFile(mime, callback) {
    var input = document.createElement('input');
    input.type = 'file';
    if (typeof mime === 'string') {
        input.accept = mime;
    }
    input.click();
    input.onchange = () => {
        fileReader(input.files[0], text => {
            input.remove();
            typeof mime === 'function' ? mime(text, input.files[0].name) : callback(text, input.files[0].name);
        });
    };
}

function fileReader(file, callback) {
    var reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => callback(reader.result);
}
