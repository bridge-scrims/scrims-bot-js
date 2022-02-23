const mysql = require("mysql");

class DBCache {

    constructor() {
        this.tickets = []
    }

    isEmpty() {
        return (this.tickets.length < 1);
    }

    getTicket(selectCondition) {
        return this.tickets.filter(ticket => Object.entries(selectCondition).every((key, value) => ticket[key] == value))[0] ?? null;
    }

    setTickets(tickets) {
        this.tickets = tickets.map(ticket => ({ ...ticket, timestamp: Date.now() }))
    }

    removeTicket(id) {
        this.tickets = this.tickets.filter(ticket => ticket.id != id)
    }

    pushTicket(ticketData) {
        if (ticketData === null) return false;

        const idx = this.tickets.indexOf(this.getTicket({ id: ticketData.id }))
        if (idx == -1) this.tickets.push(ticketData);
        else this.tickets[idx] = ticketData

        return true;
    }

}

class DBClient {

    constructor(config) {
        this.con = mysql.createPool({
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
        await this.query(`SELECT * FROM tickets`).then(tickets => this.cache.setTickets(tickets))
    }

    async queryCallback(err, results, resolve) {
        if (err) throw err;
        resolve(results);
    }
    
    async query(queryString) {
        return new Promise(resolve => this.con.query(queryString, (err, results) => this.queryCallback(err, results, resolve)))
    }

    createWhereClause(selectCondition) {
        return Object.entries(selectCondition).map((key, value) => `${key}='${value}'`).join(" AND ");
    }

    async getTicket(selectCondition) {
        const ticket = await this.query(`SELECT * FROM tickets WHERE ${this.createWhereClause(selectCondition)}`).then(rows => rows[0] ?? null)
        this.cache.pushTicket(ticket)
        return ticket;
    }

    async createTicket(id, channelId, userId) {
        const ticket = await this.query(`INSERT INTO tickets (id, userId, channelId) VALUES ('${id}', '${userId}', '${channelId}')`).then(() => ({ id, userId, channelId }))
        this.cache.pushTicket(ticket);
        return ticket;
    }

    async deleteTicket(id) {
        const response = await this.query(`DELETE FROM tickets WHERE id='${id}'`)
        this.cache.removeTicket(id)
        return response;
    }

    
}

module.exports = DBClient;