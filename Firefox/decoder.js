function decodeISO8859(text, code) {
    var result = [];
    [...text].forEach(c => {
        var code = c.charCodeAt(0);
        code < 256 && result.push(code);
    });
    return new TextDecoder(code ?? 'UTF-8').decode(Uint8Array.from(result));
}
function decodeRFC5987(text) {
    console.log('RFC5987', text);
    var head = text.slice(0, text.indexOf('\''));
    var body = text.slice(text.lastIndexOf('\'') + 1);
    if (['utf-8', 'utf8'].includes(head.toLowerCase())) {
        return decodeFileName(body);
    }
    var result = [];
    var input = body.match(/%[0-9a-fA-F]{2}|./g) ?? [];
    input.forEach(b => {
        var code = b.length === 3 ? parseInt(b.slice(1), 16) : b.charCodeAt(0);
        code < 256 && result.push(code);
    });
    return new TextDecoder(head).decode(Uint8Array.from(result));
}
function decodeRFC2047Word(value) {
    try {
        const parts = value.split('?', 6);
        if (parts.length !== 5 || parts[0] !== '=' || parts[4] !== '=')
            return undefined;
        if (!/^[-\w]+$/.test(parts[1]) || !/[!->@-~]*/.test(parts[3]))
            return undefined;
        let arr;
        if (parts[2] === 'b' || parts[2] === 'B') {
            arr = [...atob(parts[3])].map(v => v.charCodeAt(0));
        }
        else if (parts[2] === 'q' || parts[2] === 'Q') {
            arr = (parts[2].match(/=[0-9a-fA-F]{2}|./g) || [])
                .map(v => v.length === 3 ? parseInt(v.slice(1), 16) :
                v === '_' ? 0x20 : v.charCodeAt(0));
        }
        else
            return undefined;
        return new TextDecoder(parts[1]).decode(Uint8Array.from(arr));
    }
    catch {
        return undefined;
    }
}
function decodeRFC2047(text) {
    console.log('RFC2047', text);
    var result = '';
    for (const s of text.split(/\s+/)) {
        if (!s)
            continue;
        const part = decodeRFC2047Word(s);
        if (part === undefined)
            return undefined;
        result += part;
    }
    return result;
}
function decodeFileName(text) {
    try {
        return /[^\u0000-\u007f]/.test(body) ? decodeISO8859(body, 'UTF-8') : decodeURI(body);
    }
    catch {
        return console.log(text) ?? '';
    }
}
