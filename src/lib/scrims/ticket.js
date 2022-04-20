const ScrimsTicketStatus = require("./ticket_status");
const ScrimsTicketType = require("./ticket_type");
const ScrimsGuild = require("./guild");
const ScrimsUser = require("./user");

const DBCache = require("../postgresql/cache");
const DBTable = require("../postgresql/table");

class ScrimsTicketCache extends DBCache {

    /** 
     * @param { Object.<string, any> } filter
     * @param { Boolean } invert
     * @returns { ScrimsTicket[] }
     */
    get(filter, invert) {

        return super.get(filter, invert);

    }

    /**
     * @param { ScrimsTicket[] } tickets 
     */
    set(tickets) {

        const data = this.getMap('id_ticket')
        return tickets.map(ticket => this.push(ticket, data[ticket.id_ticket] ?? false, false));

    }

}

class ScrimsTicketTable extends DBTable {

    constructor(client) {

        const foreigners = [
            [ "user", "id_user", "get_user_id" ],
            [ "type", "id_type", "get_ticket_type_id" ],
            [ "status", "id_status", "get_ticket_status_id" ],
            [ "guild", "id_guild", "get_guild_id" ]
        ]

        super(client, "scrims_ticket", "get_tickets", foreigners, ScrimsTicket, ScrimsTicketCache);

        /**
         * @type { ScrimsTicketCache }
         */
        this.cache

    }
    
    /** 
     * @param { Object.<string, any> } filter
     * @param { Boolean } useCache
     * @returns { Promise<ScrimsTicket[]> }
     */
    async get(filter, useCache) {

        return super.get(filter, useCache);

    }

    /** 
     * @param { Object.<string, any> } data
     * @returns { Promise<ScrimsTicket> }
     */
    async create(data) {

        return super.create(data);

    }

    /**
     * @param { Object.<string, any> } selector
     * @returns { Promise<ScrimsTicket[]> }
     */
    async remove(selector) {

        return super.remove(selector);

    }

}

class ScrimsTicket extends DBTable.Row {

    /**
     * @type { ScrimsTicketTable }
     */
    static Table = ScrimsTicketTable

    constructor(client, ticketData) {

        const references = [
            ['type', ['id_type'], ['id_type'], client.ticketTypes], 
            ['user', ['id_user'], ['id_user'], client.users],
            ['status', ['id_status'], ['id_status'], client.ticketStatuses],
            ['guild', ['id_guild'], ['id_guild'], client.guilds]
        ]

        super(client, ticketData, references)

        /**
         * @type { number }
         */
        this.id_ticket
        
        /**
         * @type { number }
         */
        this.id_type;

        /**
         * @type { ScrimsTicketType }
         */
        this.type

        /**
         * @type { number }
         */
        this.id_user

        /**
         * @type { ScrimsUser }
         */
        this.user

        /**
         * @type { number }
         */
        this.id_status

        /**
         * @type { ScrimsTicketStatus }
         */
        this.status

        /**
         * @type { number }
         */
        this.id_guild

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

    }

    get discordGuild() {

        if (!this.guild) return null;
        return this.guild.discordGuild;

    }

    get guild_id() {

        if (!this.guild) return null;
        return this.guild.discord_id;

    }

    get channel() {

        if (!this.channel_id) return null;
        return this.bot.channels.resolve(this.channel_id);

    }

}

module.exports = ScrimsTicket;