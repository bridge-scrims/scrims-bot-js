const DBCache = require("./cache")

class DBTable {

    constructor(client, name, getFunction=null, foreigners=[], maxKeys=5000) {

        this.client = client
        this.name = name
        this.getFunction = getFunction
        this.foreigners = foreigners

        this.cache = new DBCache({ stdTTL: 3600, checkperiod: 300, maxKeys })

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
            `${Object.entries(parameters).map(([key, value], idx) => `${key} => ${this.getValue(value, idx, prevValues)}`).join(", ")}`,
            this.getValues(parameters, prevValues)
        ];

    }

    createWhereClause(selectCondition, prevValues=[]) {

        if (Object.keys(selectCondition).length === 0) return [ "", [] ];

        const getSymbol = (value) => (value == "NULL") ? "IS" : "="
        
        return [
            `WHERE ${Object.entries(selectCondition).map(([key, value], idx) => `${key}${getSymbol(value)}${this.getValue(value, idx, prevValues)}`).join(" AND ")}`,
            this.getValues(selectCondition, prevValues)
        ];

    }

    createInsertQuery(data, prevValues=[]) {

        const keys = Object.keys(data)
        const values = Object.values(data).map((value, idx) => this.getValue(value, idx, prevValues))

        return [ 
            `INSERT INTO ${this.name} (${keys.join(", ")}) VALUES (${values.join(", ")})`, 
            this.getValues(data, prevValues)
        ];

    }

    createSetClause(data, prevValues=[]) {

        return [ 
            `SET ${Object.entries(data).map(([key, value], idx) => `${key}=${this.getValue(value, idx, prevValues)}`).join(", ")}`, 
            this.getValues(data, prevValues) 
        ];

    }

    getValues(data, prevValues) {

        return [ ...prevValues, ...Object.values(data).filter(value => !(value instanceof Array)) ];

    }

    getValue(value, idx, prevValues) {

        if (value instanceof Array) return value[0];
        return `$${idx+1+prevValues.length}`;

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

    async get(selectCondition, useCache=true) { 

        const cached = this.cache.get(selectCondition)
        if (cached.length > 0 && useCache) return cached;

        const [ formated, values1 ] = this.format({ ...selectCondition })
        const query = (this.getFunction === null) ? this.createSelectQuery(formated, values1) : this.createFunctionSelectQuery(formated, values1)
        const result = await this.query( ...query )
        
        const items = (this.getFunction === null) ? result.rows : result.rows[0][this.getFunction]
        items.forEach(item => this.cache.push(item))
        return items;

    }

    async create(data) {

        const [ formated, formatValues ] = this.format({ ...data })

        await this.query( ...this.createInsertQuery(formated, formatValues) )
        
        // Fetch what was just inserted to add it to cache
        const result = await this.get({ ...data })
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

    async remove(selector) {

        const [ formated, values1 ] = this.format({ ...selector })
        const [ whereClause, values2 ] = this.createWhereClause(formated, values1)

        await this.query(`DELETE FROM ${this.name} ${whereClause}`, values2)
        
        const removed = this.cache.remove(selector)
        return removed;

    }

}

module.exports = DBTable;