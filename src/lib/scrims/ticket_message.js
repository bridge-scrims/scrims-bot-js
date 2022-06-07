const { User } = require("discord.js");
const TableRow = require("../postgresql/row");

const ScrimsTicket = require("./ticket");
const ScrimsUser = require("./user");

class ScrimsTicketMessage extends TableRow {

    static uniqueKeys = ['message_id', 'created_at']
    static columns = ['id_ticket', 'id_author', "message_id", "reference_id", "content", "deleted", "created_at"]

    constructor(client, messageData) {

        super(client, messageData)

        /** @type {number} */
        this.id_ticket

        /** @type {ScrimsTicket} */
        this.ticket

        /** @type {string} */
        this.id_author

        /** @type {ScrimsUser} */
        this.author

        /** @type {string} */
        this.message_id

        /** @type {string} */
        this.reference_id

        /** @type {string} */
        this.content

        /** @type {number} */
        this.deleted
        
        /** @type {number} */
        this.created_at

    }

    get discordGuild() {

        if (!this.ticket?.discordGuild) return null;
        return this.ticket.discordGuild;

    }

    get guild_id() {

        if (!this.ticket?.guild_id) return null;
        return this.ticket.guild_id;

    }

    get channel() {

        if (!this.ticket?.channel) return null;
        return this.ticket.channel;

    }

    get message() {

        if (!this.channel || !this.message_id) return null;
        return this.channel.messages.resolve(this.message_id);

    }

    isCacheExpired(now) {

        return (!this.ticket || this.ticket.status.name === "deleted") && super.isCacheExpired(now);
        
    }

    /**
     * @param {string|Object.<string, any>|ScrimsTicket} ticketResolvable 
     */
    setTicket(ticketResolvable) {

        this._setForeignObjectReference(this.client.tickets, 'ticket', ['id_ticket'], ['id_ticket'], ticketResolvable)
        return this;

    }

    /**
     * @param {string|Object.<string, any>|ScrimsUser|User} userResolvable 
     */
    setAuthor(userResolvable) {

        if (userResolvable instanceof User) userResolvable = { discord_id: userResolvable.id }
        
        this._setForeignObjectReference(this.client.users, 'author', ['id_author'], ['id_user'], userResolvable)
        return this;

    }

    /**
     * @param {import("discord.js").MessageResolvable} messageResolvable 
     */
    setMessage(messageResolvable) {

        this.message_id = messageResolvable?.id ?? messageResolvable
        return this;

    }

    /**
     * @param {string} reference_id
     */
    setReferenceId(reference_id) {

        this.reference_id = reference_id
        return this;

    }

    /**
     * @param {string} content
     */
    setContent(content) {

        this.content = content
        return this;

    }

    /**
     * @param {number} [deleted] If undefined will use current timestamp 
     */
    setDeletedPoint(deleted) {

        this.deleted = (deleted === undefined) ? Math.floor(Date.now()/1000) : deleted
        return this;

    }

    /**
     * @param {number} [created_at] If undefined will use current timestamp 
     */
    setCreatedPoint(created_at) {

        this.created_at = (created_at === undefined) ? Math.floor(Date.now()/1000) : created_at
        return this;

    }

    /** 
     * @override
     * @param {Object.<string, any>} messageData 
     */
    update(messageData) {
        
        super.update(messageData);

        this.setTicket(messageData.ticket)
        this.setAuthor(messageData.author)

        return this;

    }

}

module.exports = ScrimsTicketMessage;