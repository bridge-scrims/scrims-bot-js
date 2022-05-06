const DBCache = require("./cache")

class TableRow {

    constructor(client, data, references=[]) {

        Object.defineProperty(this, 'client', { value: client });
        Object.defineProperty(this, 'bot', { value: client.bot });

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

        this._references = references
        this._handles = null

        this.updateWith(data)

    }

    updateWith(data) {

        this._references.forEach(([objKey, uniqueLocalKeys, uniqueForeignKeys, table]) => {

            if (this._handles) {

                if (uniqueLocalKeys.some(key => data[key] !== undefined && data[key] != this[key])) {

                    if (this._handles[objKey]) table.cache.releaseHandle(this._handles[objKey])
                    delete this._handles[objKey];

                    const [handle, obj] = table.cache.createHandle(Object.fromEntries(uniqueLocalKeys.map((key, idx) => [uniqueForeignKeys[idx], data[key]])))
    
                    if (this._handles) this._handles[objKey] = handle
                    this[objKey] = obj
    
                } 

                if (!this[objKey] && data[objKey]) {

                    const [handle, obj] = table.cache.push(table.getRow(data[objKey]), null, true)
    
                    if (this._handles) this._handles[objKey] = handle
                    this[objKey] = obj
    
                }   
                
                if (this[objKey] && !this._handles[objKey]) {

                    const [handle, obj] = table.cache.push(this[objKey], null, true)
    
                    if (this._handles) this._handles[objKey] = handle
                    this[objKey] = obj

                }

            }else {

                if (!this[objKey] && data[objKey]) {

                    this[objKey] = table.getRow(data[objKey])
    
                } 

            }

        })

        const objKeys = this._references.map(([objKey, _, __]) => objKey)
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

    /**
     * @param { Object.<string, any> } obj 
     * @returns { Boolean }
     */
    equals(obj) {

        return this.valuesMatch(obj, this);

    }

    toJSON() {

        return Object.fromEntries(Object.entries(this).filter(([key, _]) => !key.startsWith('_')));

    }

}

class DBTable {

    static Row = TableRow;

    constructor(client, name, getFunction=null, foreigners=[], RowClass=TableRow, CacheClass=DBCache) {

        Object.defineProperty(this, 'client', { value: client });

        /**
         * @type { import('./database') }
         */
        this.client
        
        this.name = name
        this.getFunction = getFunction
        this.foreigners = foreigners

        this.RowClass = RowClass

        /**
         * @type { DBCache }
         */
        this.cache = new CacheClass()

    }

    get ipc() {

        return this.client.ipc;

    }

    async query(...args) {

        return this.client.query(...args);

    }

    async connect() {

        this.initializeListeners()
        await this.initializeCache()

    }

    initializeListeners() {



    }

    async initializeCache() {

        await this.get({ }, false)

    }

    createSelectQuery(selectCondition, prevValues=[]) {

        const [ whereClause, whereValues ] = this.createWhereClause(selectCondition, prevValues)
        return [ `SELECT * FROM ${this.name} ${whereClause}`, whereValues ];

    }

    createFunctionSelectQuery(selectCondition, prevValues=[]) {

        const [ parameters, values ] = this.createFunctionParameters(selectCondition, prevValues)
        return [ `SELECT ${this.getFunction}(${parameters})`, values ];

    }

    createFunctionParameters(parameters, prevValues=[]) {

        if (Object.keys(parameters).length === 0) return [ "", [] ];

        return [
            `${this.getEntries(parameters, prevValues).map(([key, value]) => `${key} => ${value}`).join(", ")}`,
            this.getValues(parameters, prevValues)
        ];

    }

    createWhereClause(selectCondition, prevValues=[]) {

        if (Object.keys(selectCondition).length === 0) return [ "", [] ];

        const getSymbol = (value) => (value == "NULL") ? " IS " : "="
        
        return [
            `WHERE ${this.getEntries(selectCondition, prevValues).map(([key, value]) => `${key}${getSymbol(value)}${value}`).join(" AND ")}`,
            this.getValues(selectCondition, prevValues)
        ];

    }

    createInsertQuery(data, prevValues=[]) {

        const keys = Object.keys(data)
        const values = this.getEntries(data, prevValues).map(([_, value]) => value)

        return [ 
            `INSERT INTO ${this.name} (${keys.join(", ")}) VALUES (${values.join(", ")})`, 
            this.getValues(data, prevValues)
        ];

    }

    createSetClause(data, prevValues=[]) {

        return [ 
            `SET ${this.getEntries(data, prevValues).map(([key, value]) => `${key}=${value}`).join(", ")}`, 
            this.getValues(data, prevValues) 
        ];

    }

    getValues(data, prevValues) {

        return [ ...prevValues, ...Object.values(data).filter(value => !(value instanceof Array) && value !== null) ];

    }

    getEntries(data, prevValues=[]) {

        let index = prevValues.length + 1
        return Object.entries(data).map(([key, value]) => {

            if (value === null) value = 'NULL';
            else if (value instanceof Array) value = value[0];
            else {

                value = `$${index}`
                index += 1

            }

            return [ key, value ];

        });

    }

    format(data, prevValues=[]) {

        this.foreigners.forEach(([ commonKey, localKey, translater ]) => {

            const foreigner = data[commonKey]
            if (foreigner) {

                const [ parameters, values ] = this.createFunctionParameters(foreigner, prevValues)
            
                prevValues = values
                data[localKey] = [ `${translater}(${parameters})` ]
                
                delete data[commonKey];

            }

        })

        return [ data, prevValues ];

    }

    /**
     * @param { Object.<string, any>[] } rowDatas 
     * @returns { TableRow[] }
     */
    getRows(rowDatas) {

        return rowDatas.map(rowData => this.getRow(rowData));

    }

    /**
     * @param { Object.<string, any> } rowData
     * @returns { TableRow }
     */
    getRow(rowData) {

        return new this.RowClass(this.client, rowData);

    }

    /** 
     * @returns { Promise<TableRow[]> }
     */
    async get(selectCondition, useCache=true) { 

<<<<<<< HEAD
        const cached = this.cache.find(this.getRow(selectCondition))
=======
        const cached = this.cache.get(selectCondition)
>>>>>>> main
        if (cached.length > 0 && useCache) return cached;

        const [ formated, values1 ] = this.format({ ...selectCondition })
        const query = (this.getFunction === null) ? this.createSelectQuery(formated, values1) : this.createFunctionSelectQuery(formated, values1)
        const result = await this.query( ...query )
        
        const items = (this.getFunction === null) ? result.rows : result.rows[0][this.getFunction]
        const rows = this.getRows(items)
        
        if (JSON.stringify(selectCondition) === "{}") this.cache.setAll(rows)
        else rows.forEach(row => this.cache.push(row))
        return rows;

    }

    /**
     * @param { Object.<string, any> } selectCondition
     * @param { string[] } mapKeys
     * @param { Boolean } useCache
     * @returns { Promise<Object.<string, TableRow>> }
     */
    async getMap(selectCondition, mapKeys, useCache=false) {

        const result = await this.get(selectCondition, useCache)
        return Object.fromEntries(result.map(value => [mapKeys.reduce((v, key) => (v ?? {})[key], value), value]));

    }

    /**
     * @param { Object.<string, any> } selectCondition
     * @param { string[] } mapKeys
     * @param { Boolean } useCache
     * @returns { Promise<Object.<string, TableRow[]>> }
     */
    async getArrayMap(selectCondition, mapKeys, useCache=false) {

        const obj = {}

        const result = await this.get(selectCondition, useCache)
        result.map(value => [mapKeys.reduce((v, key) => (v ?? {})[key], value), value])
            .forEach(([key, value]) => (key in obj) ? obj[key].push(value) : obj[key] = [value])
        
        return obj;

    }

    /** 
     * @returns { Promise<TableRow> }
     */
    async create(data) {

        const [ formated, formatValues ] = this.format({ ...data })

        await this.query( ...this.createInsertQuery(formated, formatValues) )
        
        // Fetch what was just inserted to add it to cache
        const result = await this.get({ ...data }).then(rows => rows[0])
        return result;

    }

    async update(selector, data) {

        const [ formatedData, values1 ] = this.format({ ...data })
        const [ setClause, values2 ] = this.createSetClause(formatedData, values1)

        const [ formatedSelector, values3 ] = this.format({ ...selector }, values2)
        const [ whereClause, values4 ] = this.createWhereClause(formatedSelector, values3)

        const result = await this.query(`UPDATE ${this.name} ${setClause} ${whereClause}`, values4)
        this.cache.update(data, selector)

        return result;

    }

    /** 
     * @returns { Promise<TableRow[]> }
     */
    async remove(selector) {

        const [ formated, values1 ] = this.format({ ...selector })
        const [ whereClause, values2 ] = this.createWhereClause(formated, values1)

        await this.query(`DELETE FROM ${this.name} ${whereClause}`, values2)
        
        const removed = this.cache.filterOut(selector)
        return removed;

    }

}

module.exports = DBTable;