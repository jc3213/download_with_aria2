function parseRFC5987(value) {
    try {
        const parts = value.split('\'');
        if (parts.length !== 3)
            return undefined;
        if (['utf-8', 'utf8'].includes(parts[0].toLowerCase()))
            return decodeURIComponent(parts[2]);
        const arr = (parts[2].match(/%[0-9a-fA-F]{2}|./g) || [])
            .map(v => v.length === 3 ? parseInt(v.slice(1), 16) : v.charCodeAt(0))
            .filter(v => v <= 255);
        return (new TextDecoder(parts[0])).decode(Uint8Array.from(arr));
    }
    catch {
        return undefined;
    }
}
function decodeISO8859_1(seq) {
    const arr = [...seq].map(v => v.charCodeAt(0)).filter(v => v <= 255);
    const encoding = getLegacyFilenameEncoding();
    return new TextDecoder(encoding).decode(Uint8Array.from(arr));
}
function parseRFC2047Word(value) {
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
function parseRFC2047(value) {
    let result = '';
    for (const s of value.split(/\s+/)) {
        if (!s)
            continue;
        const part = parseRFC2047Word(s);
        if (part === undefined)
            return undefined;
        result += part;
    }
    return result;
}
function decodeFilename(value) {
    var RFC5987 = parseRFC5987(value);
    if (RFC5987 !== undefined) {
        return RFC5987;
    }
    var RFC2047 = parseRFC2047(value);
    if (RFC2047 !== undefined) {
        return RFC2047;
    }
    try {
        return decodeURIComponent(escape(value));
    }
    catch { }
    try {
        return decodeISO8859_1(value);
    }
    catch {
        return undefined;
    }
}
