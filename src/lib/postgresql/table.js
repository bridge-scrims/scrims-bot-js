const DBCache = require("./cache")
const TableRow = require("./row")

/** @template [T=TableRow] */
class DBTable {

    /**
     * @typedef {Object.<string, any>|Array.<Object.<string, any>>|Array.<string>|Array.<Array.<string>>|T} FetchOptions
     */

    constructor(client, name, getFunction=null, cacheOptions={}, foreigners=[], RowClass=TableRow) {

        Object.defineProperty(this, 'client', { value: client });

        /**
         * @readonly
         * @type {import('./database')}
         */
        this.client
        
        /** @type {string} */
        this.name = name

        /** @type {string} */
        this.getFunction = getFunction

        /** @type {DBCache<T>} */
        this.cache = new DBCache(cacheOptions)

        /** @type {[string, string, string][]} */
        this.foreigners = foreigners

        /** @type {T.constructor} */
        this.RowClass = RowClass

    }

    /** @returns {string[]} */
    get uniqueKeys() {
        
        return this.RowClass.uniqueKeys;

    }

    get ipc() { 

        return this.client.ipc;

    }

    /**
     * @param {string} queryString 
     * @param {any[]} params 
     */
    async query(queryString, params) {

        return this.client.query(queryString, params);

    }

    async connect() {

        this.initializeListeners()
        await this.initializeCache()

    }

    initializeListeners() {

        this.ipc.on(`${this.name}_remove`, message => this.cache.filterOut(message.payload))
        this.ipc.on(`${this.name}_update`, message => this.cache.update(message.payload.selector, message.payload.data))
        this.ipc.on(`${this.name}_create`, message => this.cache.push(this.getRow(message.payload)))
        
    }

    async initializeCache() {

        await this.fetch(null, false)

    }

    createSelectQuery(selectCondition, prevValues=[]) {

        const [ whereClause, whereValues ] = this.createWhereClause(selectCondition, prevValues)
        return [ `SELECT * FROM ${this.name}${(whereClause.length > 0) ? ' WHERE ' : ''}${whereClause}`, whereValues ];

    }

    createCountQuery(selectCondition, prevValues=[]) {

        const [ whereClause, whereValues ] = this.createWhereClause(selectCondition, prevValues)
        return [ `SELECT count(*) FROM ${this.name}${(whereClause.length > 0) ? ' WHERE ' : ''}${whereClause}`, whereValues ];

    }

    createFunctionSelectQuery(selectCondition, prevValues=[]) {

        const [ parameters, values ] = this.createFunctionParameters(selectCondition, prevValues)
        return [ `SELECT ${this.getFunction}(${parameters})`, values ];

    }

    createFunctionParameters(parameters, prevValues=[]) {

        if (parameters instanceof Array) {
            if (parameters.length === 0) return [ "", [] ];
            return [
                `${this.getEntries(parameters, prevValues).join(", ")}`,
                this.getValues(parameters, prevValues)
            ];
        }

        if (Object.keys(parameters).length === 0) return [ "", [] ];
        return [
            `${this.getEntries(parameters, prevValues).map(([key, value]) => `${key} => ${value}`).join(", ")}`,
            this.getValues(parameters, prevValues)
        ];

    }

    /**
     * @param {string} functionName 
     * @param {Object.<string, any>|Array.<string>} parameters 
     */
    async callFunction(functionName, parameters) {

        if (!(parameters instanceof Array)) parameters = this.format(parameters)
        const [ formatedParameters, values ] = this.createFunctionParameters(parameters)
        const result = await this.query(`SELECT ${functionName}(${formatedParameters})`, values)
        return (result.rows[0] ?? {})[functionName];

    }

    createWhereClause(selectCondition, prevValues=[]) {

        if (Object.keys(selectCondition).length === 0) return [ "True", [] ];

        const getSymbol = (value) => (value === "NULL") ? " IS " : "="
        
        return [
            `${this.getEntries(selectCondition, prevValues).map(([key, value]) => `${key}${getSymbol(value)}${value}`).join(` AND `)}`,
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

        if (!(data instanceof Array)) data = Object.values(data)
        return [ ...prevValues, ...data.filter(value => !(value instanceof Array) && value !== null && value !== undefined) ];

    }

    getRealValues(index) {

        return (a) => {

            const getValue = (e) => (a instanceof Array) ? [a[0], e] : e;
            const value = (a instanceof Array) ? a[1] : a

            if (value === null) return getValue('NULL');
            if (value instanceof Array) return getValue(`(${value[0]})`);
            
            const v = getValue(`$${index}`);
            index += 1
            return v;

        }

    }

    getEntries(data, prevValues=[]) {

        if (data instanceof Array) return data.filter(v => v !== undefined).map(this.getRealValues(prevValues.length + 1));
        
        const e = Object.entries(data).filter(([_, v]) => v !== undefined).map(this.getRealValues(prevValues.length + 1));
        return e;

    }

    format(data, prevValues=[]) {

        const formatedData = {}
        this.foreigners.forEach(([ commonKey, localKey, translater ]) => {

            const foreigner = data[commonKey]
            if (foreigner && data[localKey] === undefined) {

                const [ parameters, values ] = this.createFunctionParameters(foreigner, prevValues)
            
                prevValues = values
                formatedData[localKey] = [ `${translater}(${parameters})` ]
                formatedData[commonKey] = undefined

            }

        })

        return [ { ...data, ...formatedData }, prevValues ];

    }

    /**
     * @param { Object.<string, any>[] } rowDatas 
     * @returns { T[] }
     */
    getRows(rowDatas) {

        return rowDatas.map(rowData => this.getRow(rowData));

    }

    /**
     * @param { Object.<string, any> } rowData
     * @returns { T }
     */
    getRow(rowData) {

        if (rowData instanceof this.RowClass) return rowData;
        return new this.RowClass(this.client, rowData);

    }

    /**
     * @param {FetchOptions} [options] If fasley, fetches all.
     * @param {boolean} [useCache]
     * @returns {Promise<T[]>}
     */
    async fetch(options, useCache=false) {

        if (useCache) {
            const cached = this.cache.get(options)
            if (cached?.length > 0) return cached;
        }

        const rows = await this._makeFetchQuery(options).then(rows => this.getRows(rows))
        
        if (!options) this.cache.setAll(rows)
        else rows.forEach(row => this.cache.push(row))
        return rows;

    }

    /**
     * @param {Object.<string, any>|Array.<Object.<string, any>>} [options] If fasley, counts all.
     * @returns {Promise<number>}
     */
    async count(options) {

        if (options instanceof Array) {

            const [ conditions, values ] = options.reduce(([conditions, values], id) => {

                const [ thisConditions, thisValues ] = this.createWhereClause(...this.format(id, values))
                return [ conditions.concat(thisConditions), thisValues ];

            }, [ [], [] ])

            options = [ `SELECT count(*) FROM ${this.name} WHERE ${conditions.map(v => `(${v})`).join(' OR ')}`, values ];

        }else {

            options = this._getObjectSelector(options ?? {})
            options = this.format(options ?? {})
            options = this.createCountQuery(...options)

        }

        const result = await this.query(...options)
        return parseInt((result.rows[0] ?? {})["count"] ?? 0);

    }

    _getSelectorFromId(id) {

        if (!(id instanceof Array)) id = [id] 
        return Object.fromEntries(this.uniqueKeys.map((key, idx) => [key, id[idx]]));

    } 

    _getFetchQuery(options) {

        if (options instanceof Array) {

            const [ conditions, values ] = options.reduce(([conditions, values], id) => {

                const [selector, selectorValues] = (() => {

                    if (typeof id === "string" || id instanceof Array) return [this._getSelectorFromId(id), values];
                    else return this.format(id, values)

                })()

                const [ thisConditions, thisValues ] = this.createWhereClause(selector, selectorValues)
                return [ conditions.concat(thisConditions), thisValues ];

            }, [ [], [] ])

            return [ `SELECT * FROM ${this.name}` + (conditions.length > 0 ? ` WHERE ${conditions.map(v => `(${v})`).join(' OR ')}` : ''), values ];

        }

        if (options instanceof TableRow) options = options.toJSON(false)

        options = this._getObjectSelector(options ?? {})
        options = this.format(options ?? {})

        if (this.getFunction) return this.createFunctionSelectQuery(...options);
        return this.createSelectQuery(...options);

    }

    _getObjectSelector(obj) {

        if (this.uniqueKeys.length > 0 && this.uniqueKeys.every(key => obj[key] !== undefined)) {
            return Object.fromEntries(this.uniqueKeys.map(key => [key, obj[key]]))
        }
        return obj;
        
    }

    async _makeFetchQuery(options) {

        const query = this._getFetchQuery(options)
        const result = await this.query(...query)
        return (result.rows[0] ?? {})[this.getFunction] ?? result.rows;

    }

    /**
     * @param {Object.<string, any>|Array.<string>|string|number|T} options
     * @param {boolean} [useCache]
     * @returns {Promise<T>}
     */
    async find(options, useCache=true) {

        if (useCache) {
            const cached = this.cache.find(options)
            if (cached) return cached;
        }

        if (options instanceof Array || typeof options !== "object") options = this._getSelectorFromId(options)

        const rows = await this._makeFetchQuery(options)
        if (rows.length === 0) return null;
        
        const row = this.getRow(rows[0])
        this.cache.push(row)
        return row;

    }

    /**
     * @param {FetchOptions} selectCondition
     * @param { string[] } mapKeys
     * @param { Boolean } useCache
     * @returns { Promise<{ [x: string]: T }> }
     */
    async getMap(selectCondition, mapKeys, useCache=false) {

        const result = await this.fetch(selectCondition, useCache)
        return Object.fromEntries(result.map(value => [mapKeys.reduce((v, key) => (v ?? {})[key], value), value]));

    }

    /**
     * @param {FetchOptions} selectCondition
     * @param { string[] } mapKeys
     * @param { Boolean } useCache
     * @returns { Promise<{ [x: string]: T[] }> }
     */
    async getArrayMap(selectCondition, mapKeys, useCache=false) {

        const obj = {}

        const result = await this.fetch(selectCondition, useCache)
        result.map(value => [mapKeys.reduce((v, key) => (v ?? {})[key], value), value])
            .forEach(([key, value]) => (key in obj) ? obj[key].push(value) : obj[key] = [value])
        
        return obj;

    }

    /** 
     * @param { Object.<string, any> | T } data
     * @returns { Promise<T> }
     */
    async create(data) {

        const obj = this.getRow(data)
        if (obj.id) this.cache.push(obj)

        const result = await this.query(...this.createInsertQuery(...this.format(obj.toJSON(false)))).catch(error => error)
        if (result instanceof Error) {
            if (obj.id) this.cache.remove(obj.id)
            throw result;
        }

        // Fetch what was just inserted to add it to cache
        if (!obj.id || obj.partial) return this.find(obj, false);
        return obj;

    }

    /** 
     * @param {Object.<string, any>|T|string|number|Array.<string>} selector
     * @param {Object.<string, any>} data
     */
    async update(selector, data) {

        if (selector instanceof TableRow) selector.update(data)
        if (selector instanceof Array || typeof selector !== "object") selector = this._getSelectorFromId(selector)
        else selector = this._getObjectSelector(selector)

        const existing = this.cache.find(selector)?.toJSON(false) ?? null
        this.cache.update(selector, data)

        const [ formatedData, values1 ] = this.format(data)
        const [ setClause, values2 ] = this.createSetClause(formatedData, values1)

        const [ formatedSelector, values3 ] = this.format(selector, values2)
        const [ whereClause, values4 ] = this.createWhereClause(formatedSelector, values3)

        const result = await this.query(`UPDATE ${this.name} ${setClause} WHERE ${whereClause}`, values4).catch(error => error)
        if (result instanceof Error) {
            if (existing) this.cache.update(selector, existing)
            throw result;
        }
        return result;

    }

    /** 
     * @param { Object.<string, any> | T } selector
     * @returns { Promise<T[]> }
     */
    async remove(selector) {

        selector = this._getObjectSelector(selector)
        const removed = this.cache.filterOut(selector)

        const [ formated, values1 ] = this.format(selector)
        const [ whereClause, values2 ] = this.createWhereClause(formated, values1)

        const result = await this.query(`DELETE FROM ${this.name} WHERE ${whereClause} RETURNING *`, values2).catch(error => error)
        if (result instanceof Error) {
            removed.forEach(removed => this.cache.push(removed))
            throw result;
        }
        return (result.rows ?? []).map(row => this.getRow(row));

    }

}

module.exports = DBTable;