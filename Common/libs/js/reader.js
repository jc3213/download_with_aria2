function readLocalFile(mime, callback, blob) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = mime;
    input.click();
    input.onchange = () => {
        fileReader(input.files[0], callback, blob);
        input.remove();
    };
}

function fileReader(file, callback, blob = false) {
    var reader = new FileReader();
    reader.onload = () => callback(reader.result, file.name);
    blob ? reader.readAsDataURL(file) : reader.readAsText(file);
}
