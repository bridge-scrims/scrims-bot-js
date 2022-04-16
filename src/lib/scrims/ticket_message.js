const DBTable = require("../postgresql/table");
const DBCache = require("../postgresql/cache");
const ScrimsTicket = require("./ticket");
const ScrimsUser = require("./user");

class ScrimsTicketMessagesCache extends DBCache {

    /** 
     * @param { Object.<string, any> } filter
     * @param { Boolean } invert
     * @returns { ScrimsTicketMessage[] }
     */
    get(filter, invert) {

        return super.get(filter, invert);

    }

}

class ScrimsTicketMessagesTable extends DBTable {

    constructor(client) {

        const foreigners = [
            [ "ticket", "id_ticket", "get_ticket_id" ],
            [ "author", "id_author", "get_user_id" ]
        ]

        super(client, "scrims_ticket_message", "get_ticket_messages", foreigners, ScrimsTicketMessage, ScrimsTicketMessagesCache);

        /**
         * @type { ScrimsTicketMessagesCache }
         */
        this.cache

    }
    
    /** 
     * @param { Object.<string, any> } filter
     * @param { Boolean } useCache
     * @returns { Promise<ScrimsTicketMessage[]> }
     */
    async get(filter, useCache) {

        return super.get(filter, useCache);

    }
    
    /** 
     * @param { Object.<string, any> } data
     * @returns { Promise<ScrimsTicketMessage> }
     */
    async create(data) {

        return super.create(data);

    }

    /**
     * @param { Object.<string, any> } selector
     * @returns { Promise<ScrimsTicketMessage[]> }
     */
    async remove(selector) {

        return super.remove(selector);

    }

}

class ScrimsTicketMessage extends DBTable.Row {

    /**
     * @type { ScrimsTicketMessagesTable }
     */
    static Table = ScrimsTicketMessagesTable

    constructor(client, messageData) {

        super(client, {})

        /**
         * @type { Integer }
         */
        this.id_ticket = messageData.id_position;

        /**
         * @type { ScrimsTicket }
         */
        this.ticket
        this.setTicket(messageData.ticket)

        /**
         * @type { Integer }
         */
        this.id_author = messageData.id_author;

        /**
         * @type { ScrimsUser }
         */
        this.author
        this.setAuthor(messageData.author)

        /**
         * @type { String }
         */
        this.message_id = messageData.message_id;

        /**
         * @type { String }
         */
        this.content = messageData.content;

        /**
         * @type { Integer }
         */
        this.deleted = messageData.deleted;
        
        /**
         * @type { Integer }
         */
        this.created_at = messageData.created_at;

    }

    get guild() {

        if (!this.ticket?.guild) return null;
        return this.ticket.guild;

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

    setAuthor(obj) {

        if (obj === null) this.author = null

        this.author = (obj instanceof ScrimsUser) ? obj : this.client.users.cache.get({ id_user: this.id_author })[0]

    }

    setTicket(obj) {

        if (obj === null) this.ticket = null

        this.ticket = (obj instanceof ScrimsTicket) ? obj : this.client.tickets.cache.get({ id_ticket: this.id_ticket })[0]

    }

    /**
     * @override 
     */
    updateWith(data) {

        if (data.id_ticket && (data.id_ticket != this.id_ticket)) {

            this.id_ticket = data.id_ticket
            this.setTicket(data.ticket)

        }
        
        if (data.id_author && (data.id_author != this.id_author)) {

            this.id_author = data.id_author
            this.setAuthor(data.author)

        }

        if (data.message_id) this.message_id = data.message_id;

        if (data.content) this.content = data.content;

        if (data.deleted) this.deleted = data.deleted;

        if (data.created_at) this.created_at = data.created_at;

        return this;
        
    }

}

module.exports = ScrimsTicketMessage;