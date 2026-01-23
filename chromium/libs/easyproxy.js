class EasyProxy {
    static #instances = [];
    static #etld = new Set([ 'ac', 'co', 'com', 'edu', 'go', 'gov', 'ne', 'net', 'or', 'org', 'sch' ]);
    static #pasScript = `
function FindProxyForURL(url, host) {
    while (true) {
        var hit = RULES[host];
        if (hit) {
            return hit;
        }
        var dot = host.indexOf(".");
        if (dot < 0) {
            return "DIRECT";
        }
        host = host.substring(dot + 1);
    }
}
`;

    #id;
    #proxy;
    #script;
    #data = new Set();
    #route = {};
    #empty = true;
    #global = false;

    constructor(string) {
        if (!/^(DIRECT|BLOCK|(HTTPS?|SOCKS5?) [A-Za-z0-9.-]+:\d{1,5})$/.test(string)) {
            throw new TypeError('Invalid proxy handler: excpeted "PROXY_TYPE HOST:PORT"');
        }
        let i = EasyProxy.#instances;
        this.#id = `PROXY${i.length}`;
        this.#proxy = string;
        i.push(this);
    }

    get data() {
        return [...this.#data];
    }

    get route() {
        return this.#route;
    }

    get proxy() {
        return this.#proxy;
    }

    get pacScript() {
        return this.#empty
            ? 'function FindProxyForURL(url, host) {\n    return "DIRECT";\n}'
            : this.#global
            ? `function FindProxyForURL(url, host) {\n    return "${this.#proxy}";\n}`
            : `var ${this.#id} = "${this.#proxy}";\n\nvar RULES = {\n${this.#script}\n};\n${EasyProxy.#pasScript}`;
    }

    static get pacScript() {
        let ids = [];
        let rules = [];
        for (let i of EasyProxy.#instances) {
            if (i.#empty) {
                continue;
            }
            if (i.#global) {
                return `function FindProxyForURL(url, host) {\n    return "${i.#proxy}";\n}`;
            }
            ids.push(`var ${i.#id} = "${i.#proxy}";`);
            rules.unshift(i.#script);
        }
        return rules.length === 0
            ? 'function FindProxyForURL(url, host) {\n    return "DIRECT";\n}'
            : `${ids.join('\n')}\n\nvar RULES = {\n${rules.join(',\n')}\n};\n${EasyProxy.#pasScript}`;
    }

    static make(host) {
        let array = host.split('.');
        if (array.length < 2) {
            return host;
        }
        let sbd = array.at(-3);
        let sld = array.at(-2);
        let tld = array.at(-1);
        return sbd && EasyProxy.#etld.has(sld)
            ? `${sbd}.${sld}.${tld}`
            : `${sld}.${tld}`;
    }

    static test(host) {
        for (let i of EasyProxy.#instances) {
            if (i.#proxy !== 'DIRECT' && i.test(host)) {
                return true;
            }
        }
        return false;
    }

    static delete(arg) {
        let remove = new Set(Array.isArray(arg) ? arg : [arg]);
        let array = [];
        for (let i of EasyProxy.#instances) {
            if (!remove.has(i.#proxy)) {
                array.push(i);
            }
        }
        EasyProxy.#instances = array;
    }

    #sync() {
        this.#empty = this.#data.size === 0;
        this.#global = this.#data.has('*');
        this.#make();
    }

    #make() {
        this.#script = JSON.stringify(this.#route, null, 4).slice(2, -2).replaceAll(`"${this.#proxy}"`, this.#id);
    }

    new(arg) {
        this.#data = new Set();
        this.#route = {};
        this.add(arg);
    }

    add(arg) {
        let add = Array.isArray(arg) ? arg : typeof arg === 'string' ? [arg] : [];
        for (let a of add) {
            this.#data.add(a);
            this.#route[a] = this.#proxy;
        }
        this.#sync();
    }

    delete(arg) {
        let remove = Array.isArray(arg) ? arg : typeof arg === 'string' ? [arg] : [];
        for (let r of remove) {
            this.#data.delete(r);
            delete this.#route[r];
        }
        this.#sync();
    }

    test(host) {
        if (this.#empty) {
            return false;
        }
        if (this.#global) {
            return true;
        }
        while (true) {
            if (this.#route[host]) {
                return true;
            }
            let dot = host.indexOf('.');
            if (dot < 0) {
                return false;
            }
            host = host.substring(dot + 1);
        }
    }
}
