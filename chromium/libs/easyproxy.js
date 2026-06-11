class EasyProxy {
    static #instances = new Set();
    static #etld = new Set([ 'ac', 'co', 'com', 'edu', 'go', 'gov', 'ne', 'net', 'or', 'org', 'sch' ]);
    static #pacScript = `
function FindProxyForURL(url, host) {
    for (;;) {
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

    static getScript(instances) {
        let proxies = [];
        let scripts = [];
        for (let i of instances) {
            let global = i.#routing['*'];
            if (global) {
                return 'function FindProxyForURL(url, host) {\n    return "' + global + '";\n}\n';
            }
            for (let entries of i.#rules) {
                let proxy = entries[0];
                let rules = entries[1];
                if (rules.size === 0) {
                    continue;
                }
                let id;
                if (proxy === 'DIRECT') {
                    id = '"DIRECT"';
                } else {
                    id = 'PROXY' + proxies.length;
                    proxies.push('var ' + id + ' = "' + proxy + '";');
                }
                for (let r of rules) {
                    scripts.push('    "' + r + '": ' + id);
                }
            }
        }
        if (proxies.length === 0) {
            return 'function FindProxyForURL(url, host) {\n    return "DIRECT";\n}\n';
        }
        return proxies.join('\n') + '\n\nvar RULES = {\n' + scripts.join(',\n') + '\n};\n' + EasyProxy.#pacScript;
    }

    static get pacScript() {
        return EasyProxy.getScript(EasyProxy.#instances);
    }

    static makeRule(host) {
        let array = host.split('.');
        if (array.length < 2) {
            return host;
        }
        let sbd = array.at(-3);
        let sld = array.at(-2);
        let tld = array.at(-1);
        if (sbd && EasyProxy.#etld.has(sld)) {
            return sbd + '.' + sld + '.' +tld;
        }
        return sld + '.' +tld;
    }

    #rules = new Map();
    #routing = {};

    constructor() {
        EasyProxy.#instances.add(this);
    }

    get routing() {
        return this.#routing;
    }

    get pacScript() {
        return EasyProxy.getScript([this]);
    }

    getScript(proxy) {
        let rules = this.#rules.get(proxy);
        if (!rules || rules.size === 0) {
            return 'function FindProxyForURL(url, host) {\n    return "DIRECT";\n}\n';
        }
        if (rules.has('*')) {
            return 'function FindProxyForURL(url, host) {\n    return "' + proxy + '";\n}\n';
        }
        let scripts = [];
        for (let r of rules) {
            scripts.push('    "' + r + '": PROXY');
        }
        return 'var PROXY = "' + proxy + '";\n\nvar RULES = {\n' + scripts.join(',\n') + '\n};\n' + EasyProxy.#pacScript;
    }

    addProxy(proxy, rules) {
        let prev = this.#rules.get(proxy);
        if (prev) {
            for (let i of prev) {
                delete this.#routing[i];
            }
        }
        if (!rules) {
            this.#rules.set(proxy, new Set());
            return true;
        }
        let next = new Set(rules);
        this.#rules.set(proxy, next);
        for (let r of next) {
            this.#routing[r] = proxy;
        }
        return true;
    }

    removeProxy(proxy) {
        let rules = this.#rules.get(proxy);
        if (!rules) {
            return false;
        }
        this.#rules.delete(proxy);
        for (let r of rules) {
            delete this.#routing[r];
        }
        return true;
    }

    hasProxy(proxy) {
        return this.#rules.has(proxy);
    }

    findProxy(host) {
        for (;;) {
            let proxy = this.#routing[host];
            if (proxy) {
                return proxy;
            }
            let dot = host.indexOf('.');
            if (dot < 0) {
                return;
            }
            host = host.substring(dot + 1);
        }
    }

    listProxies() {
        return [...this.#rules.keys()];
    }

    addRule(proxy, rule) {
        let find = this.#routing[rule];
        if (find) {
            return false;
        }
        let rules = this.#rules.get(proxy);
        if (rules) {
            rules.add(rule);
        } else {
            this.#rules.set(proxy, new Set([rule]));
        }
        this.#routing[rule] = proxy;
        return true;
    }

    removeRule(proxy, rule) {
        let find = this.#routing[rule];
        if (!find) {
            return false;
        }
        this.#rules.get(proxy).delete(rule);
        delete this.#routing[rule];
        return true;
    }

    hasRule(rule) {
        return rule in this.#routing;
    }

    getRules(proxy) {
        let rules = this.#rules.get(proxy);
        if (rules) {
            return [...rules];
        }
        if (proxy !== null && proxy !== undefined) {
            return;
        }
        let result = {};
        for (let entries of this.#rules) {
            let proxy = entries[0];
            let rules = entries[1];
            result[proxy] = [...rules];
        }
        return result;
    }

    purgeRules() {
        for (let k of this.#rules.keys()) {
            this.#rules.set(k, new Set());
        }
        this.#routing = {};
    }

    destroy() {
        this.#rules = new Map();
        this.#routing = {};
        EasyProxy.#instances.delete(this);
        return true;
    }
}
