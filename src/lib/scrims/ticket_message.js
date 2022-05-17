const DBTable = require("../postgresql/table");
const ScrimsTicket = require("./ticket");
const ScrimsUser = require("./user");
const TableRow = require("../postgresql/row");

/**
 * @extends DBTable<ScrimsTicketMessage>
 */
class ScrimsTicketMessagesTable extends DBTable {

    constructor(client) {

        const foreigners = [
            [ "ticket", "id_ticket", "get_ticket_id" ],
            [ "author", "id_author", "get_user_id" ]
        ]

        const uniqueKeys = [ 'id_ticket', 'message_id', 'created_at' ]

        super(client, "scrims_ticket_message", "get_ticket_messages", foreigners, uniqueKeys, ScrimsTicketMessage);

    }
    
}

class ScrimsTicketMessage extends TableRow {

    /**
     * @type { ScrimsTicketMessagesTable }
     */
    static Table = ScrimsTicketMessagesTable

    constructor(table, messageData) {

        const references = [
            ['ticket', ['id_ticket'], ['id_ticket'], table.client.tickets], 
            ['author', ['id_author'], ['id_user'], table.client.users]
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

}

module.exports = ScrimsTicketMessage;