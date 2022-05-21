class TableRow {

    constructor(table, data, references=[]) {

        Object.defineProperty(this, 'table', { value: table });

        Object.defineProperty(this, 'client', { value: table.client });
        Object.defineProperty(this, 'bot', { value: table.client.bot });

        /**
         * @type { import('./table') }
         * @readonly
         */
        this.table

        /**
         * @type { import('./database') }
         * @readonly
         */
        this.client

        /**
         * @type { import('../bot') }
         * @readonly
         */
        this.bot

        /**
         * @type { [string, string[], string[], import('./table')][] }
         */
        this._references = references

        this._handles = null

        this.updateWith(data)

    }

    get id() {

        if (!this.uniqueKeys.every(key => (key in this))) return null;
        return this.uniqueKeys.map(key => this[key]).join('#');

    }

    get uniqueKeys() {

        return this.table.uniqueKeys;

    }

    get columns() {

        return this.table.columns;

    }

    get partial() {

        return this.columns.some(key => this[key] === undefined);

    }

    /**
     * @param { import('./table') } table
     * @param { string } objKey
     */
    removePotentialHandle(table, objKey) {

        if (this._handles && objKey in this._handles) {

            table.cache.releaseHandle(this._handles[objKey])
            delete this._handles[objKey]

        }

    }

    /**
     * @param { import('./table') } table
     * @param { TableRow } existingObject 
     * @param { string } objKey
     * @returns { [number, TableRow] }
     */
    createHandle(table, existingObject, objKey) {

        this.removePotentialHandle(table, objKey)
        
        return table.cache.createHandle(existingObject.id);

    }

    /**
     * @param { import('./table') } table
     * @param { TableRow } existingObject 
     * @param { string } objKey
     */
    setObjectFromExistingObject(table, existingObject, objKey) {

        //Building a row out of the row data
        if (!(existingObject instanceof TableRow)) existingObject = table.getRow(existingObject)

        if (this._handles) {

            //This object is cached so we will add the existingObject to cache if it is not already there and add a handle to it
            const [handleId, row] = this.createHandle(table, existingObject, objKey)
            if (handleId && row) {

                this._handles[objKey] = handleId
                this[objKey] = row
                return;

            }

        }

        this[objKey] = this.getObject(table, existingObject)

    }

    getObject(table, filter) {

        if (!filter.partial) return filter;
        if (filter.id) return table.cache.resolve(filter.id);
        return table.cache.get(filter)[0] ?? null;

    }

    /**
     * @param { import('./table') } table 
     * @param { string } objKey
     * @param { Object.<string, any> } data
     * @param { string[] } uniqueLocalKeys 
     * @param { string[] } uniqueForeignKeys 
     */
    setObjectFromUniqueKeys(table, objKey, data, uniqueLocalKeys, uniqueForeignKeys) {

        if (uniqueLocalKeys.every(key => data[key] === null)) {

            this[objKey] = null
            return;
            
        }

        //Building a partial row to use as a filter below
        const filter = table.getRow(Object.fromEntries(uniqueLocalKeys.map((localKey, idx) => [uniqueForeignKeys[idx], data[localKey]])))

        if (this._handles) {

            //This row is cached so find & create a handle with the object in cache
            const [handleId, row] = this.createHandle(table, filter, objKey)
            if (handleId && row) {

                this._handles[objKey] = handleId
                this[objKey] = row

            }

        }else {

            //This row is not cached so no worry about handles
            this[objKey] = this.getObject(table, filter)

        }
        
    }

    updateWith(data) {

        this._references.forEach(([objKey, uniqueLocalKeys, uniqueForeignKeys, table]) => {

            const existingObject = data[objKey]

            if (existingObject) {

                //We have a object for this property but it could be partial (filter) or it may not be a reference
                if (!this[objKey] || !this[objKey].equals(existingObject))
                    this.setObjectFromExistingObject(table, existingObject, objKey)

            }else if (uniqueLocalKeys.every(key => (key in data))) {

                //We have to find the object using unique keys
                if (!this[objKey] || !uniqueLocalKeys.every(key => this[objKey][key] === data[key]))
                    this.setObjectFromUniqueKeys(table, objKey, data, uniqueLocalKeys, uniqueForeignKeys)

            }

            const foreignObject = this[objKey]
            
            //At this point the foreign Object is most likely set but now we make sure that its unique keys are transfered
            uniqueLocalKeys.forEach((key, idx) => {

                if (foreignObject && uniqueForeignKeys[idx] && (uniqueForeignKeys[idx] in foreignObject)) {

                    this[key] = foreignObject[uniqueForeignKeys[idx]]

                }else {

                    if (this[key]) this[key] = null

                }

            })

            //Now we make sure that if we are cached that we have handles to any foreigners
            if (foreignObject && this._handles) {

                if (!(objKey in this._handles)) {

                    this.setObjectFromExistingObject(table, foreignObject, objKey)

                }

            }

        })

        //Here we override everything of this from data except for if the key is a system key or the value is a reference (bcs that was already taken care of above)
        const objKeys = this._references.map(([objKey, _, __, ___]) => objKey)
        Object.entries(data).forEach(([key, value]) => {

            if (key.startsWith('_')) return;
            if (!objKeys.includes(key)) this[key] = value

        })

        return this;

    }

    cache() {

        this._handles = {}
        this.updateWith(this)

    }

    uncache() {

        if (this._handles) {

            Object.entries(this._handles)
                .forEach(([key, value]) => this._references.filter(([objKey, _, __, ___]) => objKey === key)[0][3].cache.releaseHandle(value))

        }

        this._handles = null

    }

    /**
     * @param { Object.<string, any> } obj1 
     * @param { Object.<string, any> } obj2 
     * @returns { Boolean }
     */
    valuesMatch(obj1, obj2) {

        if (!obj1 || !obj2) return false;

        if (typeof obj1.toJSON === "function") obj1 = obj1.toJSON();
        if (typeof obj2.toJSON === "function") obj2 = obj2.toJSON();

        return Object.entries(obj1).every(([key, value]) => 
            (value instanceof Object && obj2[key] instanceof Object) 
                ? this.valuesMatch(value, obj2[key]) : (obj2[key] == value)
        );

    }

    getSelector() {

        if (!this.uniqueKeys.every(key => (key in this))) return null;

        return Object.fromEntries(this.uniqueKeys.map(key => [key, this[key]]));

    }

    /**
     * @param { Object.<string, any> } obj 
     * @returns { Boolean }
     */
    equals(obj) {

        if ((obj instanceof TableRow) && obj.id && this.id)
            return obj.id == this.id;

        return this.exactlyEquals(obj);

    }

    /**
     * @param { Object.<string, any> } obj 
     * @returns { Boolean }
     */
    exactlyEquals(obj) {

        const objKeys = this._references.map(([objKey, _, __, ___]) => objKey)
        return this.valuesMatch(Object.fromEntries(Object.entries(obj).filter(([key, _]) => this.columns.includes(key) || objKeys.includes(key))), this);

    }

    toMinimalForm() {

        const columns = Object.fromEntries(Object.entries(this).filter(([key, _]) => this.columns.includes(key)))
        Object.keys(this).forEach((key) => {

            const reference = this._references.filter(([objKey,  _, __, ___]) => objKey === key)[0]
            if (reference && this[key] !== undefined) {

                const [objKey, uniqueLocalKeys, uniqueForeignKeys, table] = reference
                if (uniqueLocalKeys.some(key => this[key] === undefined)) {
                    
                    uniqueLocalKeys.forEach(key => delete columns[key])
                    columns[objKey] = this[objKey]?.toMinimalForm() ?? null 

                }

            }

        })

        return columns;

    }

    async create() {

        return this.table.create(this);

    }

    toJSON() {

        return Object.fromEntries(Object.entries(this).filter(([key, _]) => !key.startsWith('_')));

    }

}

module.exports = TableRow;