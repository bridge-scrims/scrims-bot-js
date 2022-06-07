class TableRow {

    /** @type {Array.<string>} */
    static uniqueKeys = []

    /** @type {Array.<string>} */
    static columns = []

    /** 
     * @param {import('./database')} client 
     * @param {Object.<string, any>} [data] 
     */
    constructor(client, data={}) {

        Object.defineProperty(this, 'client', { value: client });

        /**
         * @type {import('./database')}
         * @readonly
         */
        this.client

        this.update(data)

    }

    get bot() {

        return this.client.bot;

    }

    get id() {

        if (this.uniqueKeys.length === 0 || !this.uniqueKeys.every(key => (key in this))) return null;
        return this.uniqueKeys.map(key => this[key]).join('#');

    }

    /** @returns {Array.<string>} */
    get uniqueKeys() {

        return this.constructor.uniqueKeys;

    }

    /** @returns {Array.<string>} */
    get columns() {

        return this.constructor.columns;

    }

    get partial() {

        return this.columns.some(key => this[key] === undefined);

    }

    isCacheExpired(now) {

        return (this._expiration !== undefined) && (this._expiration <= now);
        
    }

    setCacheExpiration(expiration) {

        this._expiration = expiration
        
    }

    /**
     * @param {import('./table')} table 
     * @param {string} objKey 
     * @param {string[]} localIdKeys 
     * @param {string[]} foreignIdKeys 
     * @param {string|number|Object.<string, any>|TableRow} resolvable 
     */
    _setForeignObjectReference(table, objKey, localIdKeys, foreignIdKeys, resolvable) {
        
        if (resolvable === null) {
            this[objKey] = null
        }else {

            if (resolvable && foreignIdKeys.every(key => resolvable[key] !== undefined))
                this[objKey] = table.cache.find(foreignIdKeys.map(key => resolvable[key]))
            else if (localIdKeys.every(key => this[key] !== undefined))
                this[objKey] = table.cache.find(localIdKeys.map(key => this[key]))
            else if (resolvable)
                this[objKey] = table.cache.find(resolvable)

            // resolvable was not found in cache but maybe it is a full object
            if (resolvable && !this[objKey] && (typeof resolvable === "object")) {

                const obj = table.getRow(resolvable)
                if (!obj.partial) this[objKey] = obj

            }
            
        }

        if (this[objKey]) localIdKeys.forEach((key, idx) => this[key] = this[objKey][foreignIdKeys[idx]] ?? null)

    }

    /**
     * @param {Object.<string, any>} data 
     */
    update(data) {

        Object.entries(data).forEach(([key, value]) => {

            if (this.columns.includes(key)) this[key] = value

        })

        return this;

    }

    /**
     * @param {Object.<string, any>} obj1 
     * @param {Object.<string, any>} obj2 
     * @returns {boolean}
     */
    valuesMatch(obj1, obj2) {

        if (!obj1 || !obj2) return false;

        if (typeof obj1.toJSON === "function") obj1 = obj1.toJSON();
        if (typeof obj2.toJSON === "function") obj2 = obj2.toJSON();

        if (obj1 === obj2) return true;

        return Object.entries(obj1).every(([key, value]) => 
            (value instanceof Object && obj2[key] instanceof Object) 
                ? this.valuesMatch(value, obj2[key]) : (obj2[key] == value)
        );

    }

    /**
     * @param {Object.<string, any>|TableRow} obj 
     * @returns {boolean}
     */
    equals(obj) {

        if (this.uniqueKeys.length > 0 && this.uniqueKeys.every(key => obj[key] !== undefined && this[key] !== undefined))
            return this.uniqueKeys.every(key => this[key] === obj[key]);

        return this.exactlyEquals(obj);

    }

    /**
     * @param {Object.<string, any>|TableRow} obj 
     * @returns {boolean}
     */
    exactlyEquals(obj) {

        return this.valuesMatch(Object.fromEntries(Object.entries(obj).filter(([key, _]) => (!key.startsWith('_')))), this);

    }

    toJSON(allValues=true) {

        return Object.fromEntries(Object.entries(this).filter(([key, _]) => allValues ? (!key.startsWith('_')) : this.columns.includes(key)));

    }

}

module.exports = TableRow;