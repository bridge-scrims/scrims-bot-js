const ScrimsTicketStatus = require("./ticket_status");
const ScrimsTicketType = require("./ticket_type");
const ScrimsGuild = require("./guild");
const ScrimsUser = require("./user");

const DBTable = require("../postgresql/table");
const TableRow = require("../postgresql/row");
const { TextChannel } = require("discord.js");

/**
 * @extends DBTable<ScrimsTicket>
 */
class ScrimsTicketTable extends DBTable {

    constructor(client) {

        const foreigners = [
            [ "user", "id_user", "get_user_id" ],
            [ "type", "id_type", "get_ticket_type_id" ],
            [ "status", "id_status", "get_ticket_status_id" ],
            [ "guild", "id_guild", "get_guild_id" ],
            [ "closer", "id_closer", "get_user_id" ]
        ]

        super(client, "scrims_ticket", "get_tickets", foreigners, ['id_ticket'], ScrimsTicket);

    }

}

class ScrimsTicket extends TableRow {

    /**
     * @type { ScrimsTicketTable }
     */
    static Table = ScrimsTicketTable

    constructor(table, ticketData) {

        const references = [
            ['type', ['id_type'], ['id_type'], table.client.ticketTypes], 
            ['user', ['id_user'], ['id_user'], table.client.users],
            ['status', ['id_status'], ['id_status'], table.client.ticketStatuses],
            ['guild', ['guild_id'], ['guild_id'], table.client.guilds],
            ['closer', ['id_closer'], ['id_user'], table.client.users]
        ]

        super(table, ticketData, references)

        /**
         * @type { number }
         */
        this.id_ticket
        
        /**
         * @type { string }
         */
        this.id_type;

        /**
         * @type { ScrimsTicketType }
         */
        this.type

        /**
         * @type { string }
         */
        this.id_user

        /**
         * @type { ScrimsUser }
         */
        this.user

        /**
         * @type { string }
         */
        this.id_status

        /**
         * @type { ScrimsTicketStatus }
         */
        this.status

        /**
         * @type { string }
         */
        this.guild_id

        /**
         * @type { ScrimsGuild }
         */
        this.guild

        /**
         * @type { string }
         */
        this.channel_id 

        /**
         * @type { number }
         */
        this.created_at

        /**
         * @type { string }
         */
        this.id_closer

        /**
         * @type { ScrimsUser }
         */
        this.closer

    }

    get discordGuild() {

        if (!this.guild) return null;
        return this.guild.discordGuild;

    }

    /**
     * @type { TextChannel }
     */
    get channel() {

        if (!this.channel_id) return null;
        return this.bot.channels.resolve(this.channel_id);

    }

}

module.exports = ScrimsTicket;