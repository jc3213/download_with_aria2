(() => {
    if (window.aria2c) {
        return;
    }

    let aria2 = 0;

    let calls = {};

    let callback = (aria2c, params) => {
        return new Promise((resolve, reject) => {
            let id = ++aria2;
            let timer = setTimeout(() => {
                delete calls[id];
                reject( new Error('"Download With Aria2" is either not installed, disabled, or lower than v4.17.0.3548.') );
            }, 3000);
            calls[id] = (result) => {
                clearTimeout(timer);
                delete calls[id];
                resolve(result);
            }
            window.postMessage({ aria2c, id, params });
        });
    };

    window.addEventListener('message', (event) => {
        let { aria2c,id, result } = event.data;
        if (aria2c === 'aria2c_response') {
            calls[id]?.(result);
        }
    });

    window.aria2c = {
        status: () => callback('aria2c_status'),
        download: (params) => callback('aria2c_download', params)
    };
})();
