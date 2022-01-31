function decodeISO8859(text) {
    var result = [];
    [...text].forEach(s => {
        var c = s.charCodeAt(0);
        c < 256 && result.push(c);
    });
    return new TextDecoder(document.characterSet ?? 'UTF-8').decode(Uint8Array.from(result));
}
function decodeRFC5987(text) {
    console.log('RFC5987', text);
    var head = text.slice(0, text.indexOf('\''));
    var body = text.slice(text.lastIndexOf('\'') + 1);
    if (['utf-8', 'utf8'].includes(head.toLowerCase())) {
        return decodeFileName(body);
    }
    var result = [];
    (body.match(/%[0-9a-fA-F]{2}|./g) ?? []).forEach(s => {
        var c = s.length === 3 ? parseInt(s.slice(1), 16) : s.charCodeAt(0);
        c < 256 && result.push(c);
    });
    return new TextDecoder(head).decode(Uint8Array.from(result));
}
function decodeRFC2047Word(text) {
    if (text.startsWith('=?') && text.endsWith('?=')) {
        var temp = text.slice(2, -2);
        var qs = temp.indexOf('?');
        var qe = temp.lastIndexOf('?');
        if (qe - qs === 2) {
            var code = temp.slice(0, qs);
            var type = temp.slice(qs + 1, qe).toLowerCase();
            var data = temp.slice(qe + 1);
            var result = type === 'b' ? [...atob(data)].map(s => s.charCodeAt(0)) :
                type === 'q' ? (parts[2].match(/=[0-9a-fA-F]{2}|./g) || []).map(v => v.length === 3 ?
                    parseInt(v.slice(1), 16) : v === '_' ? 0x20 : v.charCodeAt(0)) : null;
        }
    }
    return result ? new TextDecoder(code).decode(Uint8Array.from(result)) : '';
}
function decodeRFC2047(text) {
    console.log('RFC2047', text);
    var result = '';
    text.split(/\s+/).forEach(s => {
        var decode = decodeRFC2047Word(s);
        if (decode) {
            result += decode;
        }
    });
    return result;
}
function decodeFileName(text) {
    try {
        return /[^\u0000-\u007f]/.test(text) ? decodeISO8859(text) : decodeURI(text);
    }
    catch {
        return console.log(text) ?? '';
    }
}
