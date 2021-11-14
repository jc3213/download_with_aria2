function bytesToFileSize(bytes) {
    return bytes < 0 ? '?? B' : bytes < 1024 ? bytes + ' B' :
        bytes < 1048576 ? (bytes / 10.24 | 0) / 100 + ' KB' :
        bytes < 1073741824 ? (bytes / 10485.76 | 0) / 100 + ' MB' :
        bytes < 1099511627776 ? (bytes / 10737418.24 | 0) / 100 + ' GB' : (bytes / 10995116277.76 | 0) / 100 + ' TB';
}
