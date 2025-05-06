class Aria2 {
    constructor (...args) {
        let path = args.join('#').match(/^ws(s)?(?:#|:\/\/)([^#]+)#?(.*)$/);
        if (!path) { throw new Error(`Unsupported parameters: "${args.join('", "')}"`); }
        this.ssl = path[1];
        this.url = path[2];
        this.secret = path[3];
    }
    version = '1.0';
    #status;
    get status () {
        return this.#status;
    }
    set scheme (scheme) {
        let test = scheme.match(/^ws(s)?$/);
        if (!test) { throw new Error(`Unsupported scheme: "${args.join('", "')}"`); }
        this.ssl = test[1];
    }
    get scheme () {
        return `ws${this.#ssl}`;
    }
    #ssl;
    set ssl (ssl) {
        this.#ssl = ssl ? 's' : '';
        this.#path();
    }
    get ssl () {
        return !!this.#ssl;
    }
    #url;
    set url (url) {
        this.#url = url;
        this.#path();
    }
    get url () {
        return this.#url;
    }
    #secret;
    set secret (text) {
        this.#secret = `token:${text}`;
    }
    get secret () {
        return this.#secret.slice(6);
    }
    #retries = 10;
    set retries (number) {
        this.#retries = isNaN(number) || number < 0 ? Infinity : number;
    }
    get retries () {
        return this.#retries;
    }
    #timeout = 10000;
    set timeout (number) {
        this.#timeout = isNaN(number) ? 10000 : number * 1000;
    }
    get timeout () {
        return this.#timeout / 1000;
    }
    #onopen = null;
    set onopen (func) {
        this.#onopen = typeof func === 'function' ? func : null;
    }
    get onopen () {
        return this.#onopen;
    }
    #onmessage = null;
    set onmessage (func) {
        this.#onmessage = typeof func === 'function' ? func : null;
    }
    get onmessage () {
        return this.#onmessage;
    }
    #onclose = null;
    set onclose (func) {
        this.#onclose = typeof func === 'function' ? func : null;
    }
    get onclose () {
        return this.#onclose;
    }
    #wsa;
    #tries;
    #path () {
        this.#wsa = `ws${this.#ssl}://${this.#url}`;
        this.#tries = 0;
    }
    #json (args) {
        let json = args.map( ({ method, params = [] }) => ({ id: '', jsonrpc: '2.0', method, params: [this.#secret, ...params] }) );
        return JSON.stringify(json);
    }
    #onreceive = null;
    #send (...args) {
        let body = this.#json(args);
        return new Promise((resolve, reject) => {
            this.#onreceive = resolve;
            this.#ws.onerror = reject;
            this.#ws.send(body);
        });
    }
    #ws;
    connect () {
        this.#ws = new WebSocket(this.#wsa);
        this.#ws.onopen = async (event) => {
            let [stats, version, options, active, waiting, stopped] = await this.#send({method: 'aria2.getGlobalStat'}, {method: 'aria2.getVersion'}, {method: 'aria2.getGlobalOption'}, {method: 'aria2.tellActive'}, {method: 'aria2.tellWaiting', params: [0, 999]}, {method: 'aria2.tellStopped', params: [0, 999]});
            this.#status = {stats, version, options, active, waiting, stopped};
            if (this.#onopen) { this.#onopen(this.#status); }
        };
        this.#ws.onmessage = (event) => {
            let response = JSON.parse(event.data);
            if (!response.method) { this.#onreceive(response); }
            else if (this.#onmessage) { this.#onmessage(response); }
        };
        this.#ws.onclose = (event) => {
            this.#status = null;
            if (!event.wasClean && this.#tries++ < this.#retries) { setTimeout(() => this.connect(), this.#timeout); }
            if (this.#onclose) { this.#onclose(event); }
        };
    }
    disconnect () {
        this.#ws.close();
    }
    call = this.#send;
}
