const DBCache = require("./cache")
const TableRow = require("./row")

/** @template [T=TableRow] */
class DBTable {

    constructor(client, name, getFunction=null, foreigners=[], uniqueKeys=[], RowClass=TableRow, CacheClass=DBCache) {

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
         * @type { DBCache<T> }
         */
        this.cache = new CacheClass()

        /**
         * @type { string[] }
         */
        this.columns = []

        /**
         * @type { string[] }
         */
        this.uniqueKeys = uniqueKeys

    }

    get ipc() {

        return this.client.ipc;

    }

    async query(...args) {

        return this.client.query(...args);

    }

    async connect() {

        const schema = await this.query(`SELECT * FROM information_schema.columns WHERE table_name='${this.name}'`)
        this.columns = schema.rows.map(row => row['column_name'])

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
            if (foreigner && data[localKey] === undefined) {

                const [ parameters, values ] = this.createFunctionParameters(foreigner, prevValues)
            
                prevValues = values
                data[localKey] = [ `${translater}(${parameters})` ]

            }

            if (data[commonKey] !== undefined) delete data[commonKey];

        })

        return [ data, prevValues ];

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
        return new this.RowClass(this, rowData);

    }

    /** 
     * @returns { Promise<T[]> }
     */
    async get(selectCondition, useCache=true) { 

        const cached = this.cache.find(this.getRow(selectCondition))
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
     * @returns { Promise<{ [x: string]: T }> }
     */
    async getMap(selectCondition, mapKeys, useCache=false) {

        const result = await this.get(selectCondition, useCache)
        return Object.fromEntries(result.map(value => [mapKeys.reduce((v, key) => (v ?? {})[key], value), value]));

    }

    /**
     * @param { Object.<string, any> } selectCondition
     * @param { string[] } mapKeys
     * @param { Boolean } useCache
     * @returns { Promise<{ [x: string]: T[] }> }
     */
    async getArrayMap(selectCondition, mapKeys, useCache=false) {

        const obj = {}

        const result = await this.get(selectCondition, useCache)
        result.map(value => [mapKeys.reduce((v, key) => (v ?? {})[key], value), value])
            .forEach(([key, value]) => (key in obj) ? obj[key].push(value) : obj[key] = [value])
        
        return obj;

    }

    /** 
     * @returns { Promise<T> }
     */
    async create(data) {

        const obj = this.getRow(data)
        const inserted = obj.id ? this.cache.push(obj) : null
        const filter = inserted?.getSelector()

        if (data instanceof TableRow) data = data.toMinimalForm()
        const [ formated, formatValues ] = this.format({ ...data })

        const query = this.createInsertQuery(formated, formatValues)
        await this.query( ...query )
        
        // Fetch what was just inserted to add it to cache
        if (filter) return this.get(filter, false).then(rows => rows[0]);
        return null; 

    }

    async update(selector, data) {

        const [ formatedData, values1 ] = this.format({ ...data })
        const [ setClause, values2 ] = this.createSetClause(formatedData, values1)

        const [ formatedSelector, values3 ] = this.format({ ...selector }, values2)
        const [ whereClause, values4 ] = this.createWhereClause(formatedSelector, values3)

        const result = await this.query(`UPDATE ${this.name} ${setClause} ${whereClause}`, values4)
        this.cache.update(this.getRow(data), this.getRow(selector))

        return result;

    }

    /** 
     * @returns { Promise<T[]> }
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