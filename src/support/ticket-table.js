const DBClient = require("../bot/database")

class TicketTable extends DBClient.Table {

    constructor(client) {
        super(client)

        this.cache.tickets = []
        this.cache.getTicket = (id) => this.cache.get("tickets", { id })
    }

    async initializeCache() {
        await this.query(`SELECT * FROM ticket`).then(tickets => this.cache.set("tickets", tickets))
    }

    async get(selectCondition) {
        const ticket = await this.query(`SELECT * FROM ticket ${this.client.createWhereClause(selectCondition)}`).then(rows => rows[0] ?? null)
        this.cache.push("tickets", ticket)
        return ticket;
    }

    async create(id, channelId, userId) {
        const ticket = await this.insert("ticket", { id, userId, channelId })
        this.cache.push("tickets", ticket);
        return ticket;
    }

    async remove(id) {
        const response = await this.query(`DELETE FROM ticket ${this.client.createWhereClause({ id })}`)
        this.cache.rmv("tickets", { id })
        return response;
    }

}

module.exports = TicketTable