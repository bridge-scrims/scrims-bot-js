const DBTable = require("../postgresql/table");
const DBCache = require("../postgresql/cache");
const TableRow = require("../postgresql/row");

const ScrimsAttachment = require("./attachment");
const ScrimsTicket = require("./ticket");

class ScrimsTicketMessageAttachmentsCache extends DBCache {


}

class ScrimsTicketMessageAttachmentsTable extends DBTable {

    constructor(client) {

        const foreigners = [
            [ "ticket", "id_ticket", "get_ticket_id" ],
            [ "attachment", "attachment_id", "get_attachment_id" ]
        ]

        const uniqueKeys = [ 'id_ticket', 'message_id', 'attachment_id' ]

        super(client, "scrims_ticket_message_attachment", "get_ticket_message_attachments", foreigners, uniqueKeys, ScrimsTicketMessageAttachment, ScrimsTicketMessageAttachmentsCache);

        /**
         * @type { ScrimsTicketMessageAttachmentsCache }
         */
        this.cache

    }
    
    /** 
     * @param { Object.<string, any> } filter
     * @param { Boolean } useCache
     * @returns { Promise<ScrimsTicketMessageAttachment[]> }
     */
    async get(filter, useCache) {

        return super.get(filter, useCache);

    }
    
    /** 
     * @param { Object.<string, any> } data
     * @returns { Promise<ScrimsTicketMessageAttachment> }
     */
    async create(data) {

        return super.create(data);

    }

    /**
     * @param { Object.<string, any> } selector
     * @returns { Promise<ScrimsTicketMessageAttachment[]> }
     */
    async remove(selector) {

        return super.remove(selector);

    }

}

class ScrimsTicketMessageAttachment extends TableRow {

    /**
     * @type { ScrimsTicketMessageAttachmentsTable }
     */
    static Table = ScrimsTicketMessageAttachmentsTable

    constructor(table, messageData) {

        const references = [
            ['ticket', ['id_ticket'], ['id_ticket'], table.client.tickets],
            ['attachment', ['attachment_id'], ['attachment_id'], table.client.attachments]
        ]

        super(table, messageData, references)

        /**
         * @type { number }
         */
        this.id_ticket

        /**
         * @type { ScrimsTicket }
         */
        this.ticket
        
        /**
         * @type { string }
         */
        this.message_id

        /**
         * @type { string }
         */
        this.attachment_id

        /**
         * @type { ScrimsAttachment }
         */
        this.attachment

    }

    get attachmentURL() {

        return this.attachment.url;

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

}

module.exports = ScrimsTicketMessageAttachment;