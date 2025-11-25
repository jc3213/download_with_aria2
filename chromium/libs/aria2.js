class Aria2 {
    constructor (...args) {
        let [, url = 'http://localhost:6800/jsonrpc', secret = ''] = args.join('#').match(/^((?:http|ws)s?:\/\/[^#]+)#?(.*)$/) ?? [];
        this.url = url;
        this.secret = secret;
    }
    #url;
    #xml;
    #wsa;
    #tries;
    set url (string) {
        let [, scheme = 'http', ssl = '', url = '://localhost:6800/jsonrpc'] = string.match(/^(http|ws)(s)?(:\/\/.+)$/) ?? [];
        this.#url = `${scheme}${ssl}${url}`;
        this.#xml = `http${ssl}${url}`;
        this.#wsa = `ws${ssl}${url}`;
        this.#tries = 0;
        this.call = scheme === 'http' ? this.#post : this.#send;
    }
    get url () {
        return this.#url;
    }
    #secret;
    set secret (string) {
        this.#secret = `token:${string}`;
    }
    get secret () {
        return this.#secret.slice(6);
    }
    #retries = 10;
    set retries (number) {
        this.#retries = Number.isInteger(number) && number >= 0 ? number : Infinity;
    }
    get retries () {
        return this.#retries;
    }
    #timeout = 10000;
    set timeout (number) {
        this.#timeout = Number.isFinite(number) && number > 0 ? number * 1000 : 10000;
    }
    get timeout () {
        return this.#timeout / 1000;
    }
    #onopen = null;
    set onopen (callback) {
        this.#onopen = typeof callback === 'function' ? callback : null;
    }
    get onopen () {
        return this.#onopen;
    }
    #onmessage = null;
    set onmessage (callback) {
        this.#onmessage = typeof callback === 'function' ? callback : null;
    }
    get onmessage () {
        return this.#onmessage;
    }
    #onclose = null;
    set onclose (callback) {
        this.#onclose = typeof callback === 'function' ? callback : null;
    }
    get onclose () {
        return this.#onclose;
    }
    #send (req) {
        return new Promise((resolve, reject) => {
            let id = crypto.randomUUID();
            this[id] = resolve;
            this.#ws.onerror = reject;
            this.#ws.send(this.#json(id, req));
        });
    }
    #post (req) {
        return fetch(this.#xml, { method: 'POST', body: this.#json('', req) }).then((response) => {
            if (response.ok) {
                return response.json();
            }
            throw new Error(response.statusText);
        });
    }
    #json (id, req) {
        if (Array.isArray(req)) {
            req = {
                method: 'system.multicall',
                params: [ req.map(({ method, params = [] }) => {
                    params.unshift(this.#secret);
                    return { methodName: method, params };
                }) ]
            };
        } else {
            (req.params ??= []).unshift(this.#secret);
        }
        req.jsonrpc = '2.0';
        req.id = id;
        return JSON.stringify(req);
    }
    #ws;
    connect () {
        this.#ws = new WebSocket(this.#wsa);
        this.#ws.onopen = (event) => {
            this.#tries = 0;
            this.#onopen?.(event);
        };
        this.#ws.onmessage = (event) => {
            let response = JSON.parse(event.data);
            if (response.method) {
                this.#onmessage?.(response);
            } else {
                let { id } = response;
                this[id](response);
                delete this[id];
            }
        };
        this.#ws.onclose = (event) => {
            if (!event.wasClean && this.#tries++ < this.#retries) {
                setTimeout(() => this.connect(), this.#timeout);
            }
            this.#onclose?.(event);
        };
    }
    disconnect () {
        this.#ws.close();
    }
}
