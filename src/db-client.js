const mysql = require("mysql2");

class DBCache {

    constructor() {
        this.tickets = []
        this.messages = []
    }

    isEmpty() {
        return (this.tickets.length < 1 && this.messages.length < 1);
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

    getTicket(filter) { return this.get("tickets", filter) }
    setTickets(tickets) { this.set("tickets", tickets) }
    removeTicket(id) { this.rmv("tickets", { id }) }
    pushTicket(ticketData) { return this.push("tickets", ticketData) }

    getMessage(filter) { return this.get("messages", filter) }
    setTranscript(transcript) { this.set("messages", transcript) }
    addTranscript(transcript) { transcript.forEach(message => this.pushMessage(message)) }
    removeTranscript(ticketId) { this.rmv("messages", { ticketId }) }
    pushMessage(msg) { return this.push("messages", msg) }

}

class DBClient {

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
    }

    async initializeCache() {
        await this.query(`SELECT * FROM ticket`).then(tickets => this.cache.setTickets(tickets))
        await this.query(`SELECT * FROM message`).then(transcript => this.cache.setTranscript(transcript))
    }

    async queryCallback(err, results, resolve) {
        if (err) throw err;
        resolve(results);
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

    async getTicket(selectCondition) {
        const ticket = await this.query(`SELECT * FROM ticket ${this.createWhereClause(selectCondition)}`).then(rows => rows[0] ?? null)
        this.cache.pushTicket(ticket)
        return ticket;
    }

    async createTicket(id, channelId, userId) {
        const ticket = await this.insert("ticket", { id, userId, channelId })
        this.cache.pushTicket(ticket);
        return ticket;
    }

    async deleteTicket(id) {
        const response = await this.query(`DELETE FROM ticket ${this.createWhereClause({ id })}`)
        this.cache.removeTicket(id)
        return response;
    }

    async removeTranscript(ticketId) {
        const response = await this.query(`DELETE FROM message ${this.createWhereClause({ ticketId })}`)
        this.cache.removeTranscript(ticketId)
        return response;
    }

    async getTranscript(ticketId) {
        const transcript = await this.query(`SELECT * FROM message ${this.createWhereClause({ ticketId })}`)
        this.cache.addTranscript(transcript)
        return transcript;
    }

    async createTranscriptMessage(message, ticketId) {
        const msg = await this.insert("message", { id: message.id, ticketId, content: message.content, creation: message.createdTimestamp, authorId: message.userId, authorTag: message.user.tag })
        this.cache.pushMessage(msg)
        return msg;
    }
    
}

module.exports = DBClient;