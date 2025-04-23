let [testBtn, testResult] = document.body.children;

function aria2JsonrpcEcho() {
    return new Promise((resolve, reject) => {
        let connect = (event) => {
            let { aria2c, name, version } = event.data;
            if (aria2c === 'aria2c_response_echo') {
                clearTimeout(timer);
                window.removeEventListener('message', connect);
                resolve({ name, version });
            }
        };
        let timer = setTimeout(() => {
            window.removeEventListener('message', connect);
            reject(new Error('"Download With Aria2" has not been installed!'));
        }, 5000);
        window.addEventListener('message', connect);
        window.postMessage({ aria2c: 'aria2c_jsonrpc_echo' });
    });
}

function aria2ResponseEcho() {
    aria2JsonrpcEcho()
        .then(( { name, version } ) => {
            testResult.value = name + '\nv' + version;
        })
        .catch((err) => {
            testResult.value = err;
        });
}

testBtn.addEventListener('click', aria2ResponseEcho);

aria2ResponseEcho();
