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

    /**
     * @param { ScrimsTicketMessage[] } messages 
     */
    set(messages) {

        const data = this.getMap('message_id')
        return messages.map(message => this.push(message, data[message.message_id] ?? false, false));

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

        const references = [
            ['ticket', ['id_ticket'], ['id_ticket'], client.tickets], 
            ['author', ['id_author'], ['id_user'], client.users]
        ]

        super(client, messageData, references)

        /**
         * @type { number }
         */
        this.id_ticket

        /**
         * @type { ScrimsTicket }
         */
        this.ticket

        /**
         * @type { number }
         */
        this.id_author

        /**
         * @type { ScrimsUser }
         */
        this.author

        /**
         * @type { string }
         */
        this.message_id

        /**
         * @type { string }
         */
        this.content

        /**
         * @type { number }
         */
        this.deleted
        
        /**
         * @type { number }
         */
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

    /**
     * @override
     * @param { Object.<string, any> } obj 
     * @returns { Boolean }
     */
    equals(obj) {

        if (obj instanceof ScrimsTicketMessage) {

            return (obj.id_ticket === this.id_ticket && obj.message_id === this.message_id);

        }
        
        return this.valuesMatch(obj, this);

    }

}

module.exports = ScrimsTicketMessage;