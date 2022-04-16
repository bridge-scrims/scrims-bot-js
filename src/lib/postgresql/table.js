const DBCache = require("./cache")

class TableRow {

    constructor(client, data) {

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

        this.updateWith(data)

    }

    createHandle() {


        
    }

    updateWith(data) {

        Object.entries(data).forEach(([key, value]) => this[key] = value)
        return this;

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

        await this.get({ })

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

        const cached = this.cache.get(selectCondition)
        if (cached.length > 0 && useCache) return cached;

        const [ formated, values1 ] = this.format({ ...selectCondition })
        const query = (this.getFunction === null) ? this.createSelectQuery(formated, values1) : this.createFunctionSelectQuery(formated, values1)
        const result = await this.query( ...query )
        
        const items = (this.getFunction === null) ? result.rows : result.rows[0][this.getFunction]
        const rows = this.getRows(items)
        
        if (JSON.stringify(selectCondition) === "{}") {
            
            this.cache.set(rows)

        }else rows.forEach(row => this.cache.push(row))

        return rows;

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
        
        const removed = this.cache.remove(selector)
        return removed;

    }

}

module.exports = DBTable;