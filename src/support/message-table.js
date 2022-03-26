const DBClient = require("../bot/database")

class MessageTable extends DBClient.Table {

    constructor(client) {
        super(client)

        this.cache.messages = []
        this.cache.getMessage = (id) => this.cache.get("messages", { id })
    }

    async initializeCache() {
        await this.query(`SELECT * FROM messages`).then(messages => this.cache.set("messages", messages))
    }

    async get(ticketId) {
        const transcript = await this.query(`SELECT * FROM message ${this.client.createWhereClause({ ticketId })}`)
        this.cache.add("messages", transcript)
        return transcript;
    }

    wrap(message, ticketId) {
        return { 
            id: message.id, ticketId, content: message.content, creation: message.createdTimestamp, 
            authorId: message.userId, authorTag: message.user.tag 
        };
    }

    async create(message, ticketId) {
        const msg = await this.insert("message", this.wrap(message, ticketId))
        this.cache.push("messages", msg)
        return msg;
    }

    async remove(id) {
        const response = await this.query(`DELETE FROM message ${this.client.createWhereClause({ id })}`)
        this.cache.rmv("messages", { id })
        return response;
    }

}

module.exports = MessageTable