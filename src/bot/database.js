const mysql = require("mysql2");

const SuggestionTable = require("../suggestions/suggestion-table");
const MessageTable = require("../support/message-table");
const TicketTable = require("../support/ticket-table");

class DBCache {

    constructor() {
        this.tickets = []
        this.messages = []
        this.suggestions = []
    }

    isEmpty() {
        return (this.tickets.length < 1 && this.messages.length < 1 && this.suggestions.length < 1);
    }

    rmv(key, filter) {
        this[key] = this[key].filter(obj => !Object.entries(filter).every(([key, value]) => obj[key] == value))
    }

    get(key, filter) {
        return this[key].filter(obj => Object.entries(filter).every(([key, value]) => obj[key] == value))[0] ?? null;
    }

    set(key, values) {
        this[key] = values.map(value => ({ ...value, timestamp: Date.now() }))
    }

    push(key, value) {
        if (value === null) return false;

        const idx = this[key].indexOf(this.get(key, { id: value.id }))
        if (idx == -1) this[key].push(value);
        else this[key] = [value]

        return true;
    }

}

class DBTable {

    constructor(client) {
        this.client = client
    }

    get cache() {
        return this.client.cache;
    }

    async query(...args) {
        return this.client.query(...args);
    }

    async initializeCache() { 

    }

    async get() { 

    }

    async create() {

    }

    async remove() {

    }

}

class DBClient {

    static Table = DBTable;

    constructor(config) {
        this.con = mysql.createConnection({
            connectionLimit: 100,
            host: config.host,
            user: config.username,
            password: config.password,
            database: config.database,
            debug: false,
        });

        this.cache = new DBCache();

        this.tickets = new TicketTable(this);
        this.suggestions = new SuggestionTable(this);
        this.transcripts = new MessageTable(this);
    }

    async initializeCache() {
        await this.tickets.initializeCache()
        await this.suggestions.initializeCache()
        await this.transcripts.initializeCache()
    }
    
    async query(queryString) {
        return new Promise(resolve => this.con.query(queryString, (err, results) => resolve([err, results])))
            .then(([err, results]) => {
                if (err) throw err;
                return results;
            })
    }

    async insert(tableName, data) {
        await this.query(`INSERT INTO ${tableName} ${this.createInsertClause(data)}`)
        return data;
    }

    formatValue(value) {
        if (typeof value === "number") return value;
        if (typeof value === "string") return `'${value}'`;
        return "NULL";
    }

    createInsertClause(data) {
        return `(${Object.keys(data).join(", ")}) VALUES (${Object.values(data).map(value => this.formatValue(value)).join(", ")})`;
    }

    createWhereClause(selectCondition) {
        return "WHERE " + Object.entries(selectCondition).map(([key, value]) => `${key}=${this.formatValue(value)}`).join(" AND ");
    }
  
}

module.exports = DBClient;