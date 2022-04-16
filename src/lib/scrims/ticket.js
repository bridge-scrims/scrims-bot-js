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

}

class ScrimsTicketTable extends DBTable {

    constructor(client) {

        const foreigners = [
            [ "user", "id_user", "get_user_id" ],
            [ "type", "id_type", "get_ticket_type_id" ],
            [ "status", "id_status", "get_ticket_status_id" ],
            [ "scrimsGuild", "id_guild", "get_guild_id" ]
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

        super(client, {})

        /**
         * @type { Integer }
         */
        this.id_ticket = ticketData.id_ticket;
        
        /**
         * @type { Integer }
         */
        this.id_type = ticketData.id_type;

        /**
         * @type { { id_type: Integer, name: String } }
         */
        this.type
        this.setType(ticketData.type)

        /**
         * @type { Integer }
         */
        this.id_user = ticketData.id_user;

        /**
         * @type { ScrimsUser }
         */
        this.user
        this.setUser(ticketData.user)

        /**
         * @type { Integer }
         */
        this.id_status = ticketData.id_status;

        /**
         * @type { { id_status: Integer, name: String } }
         */
        this.status
        this.setStatus(ticketData.status)

        /**
         * @type { Integer }
         */
        this.id_guild = ticketData.id_guild;

        /**
         * @type { ScrimsGuild }
         */
        this.scrimsGuild
        this.setGuild(ticketData.guild)

        /**
         * @type { String }
         */
        this.channel_id = ticketData.channel_id;

        /**
         * @type { Integer }
         */
        this.created_at = ticketData.created_at;

    }

    get guild() {

        if (!this.scrimsGuild) return null;
        return this.scrimsGuild.guild;

    }

    get guild_id() {

        if (!this.scrimsGuild) return null;
        return this.scrimsGuild.discord_id;

    }

    get channel() {

        if (!this.channel_id) return null;
        return this.bot.channels.resolve(this.channel_id);

    }

    setType(obj) {

        if (obj === null) this.type = null

        this.type = (obj instanceof ScrimsTicketType) ? obj : this.client.ticketTypes.cache.get({ id_type: this.id_type })[0]

    }

    setUser(obj) {

        if (obj === null) this.user = null

        this.user = (obj instanceof ScrimsUser) ? obj : this.client.users.cache.get({ id_user: this.id_user })[0]

    }

    setStatus(obj) {

        if (obj === null) this.status = null

        this.status = (obj instanceof ScrimsTicketStatus) ? obj : this.client.ticketStatuses.cache.get({ id_status: this.id_status })[0]

    }
    
    setGuild(obj) {

        if (obj === null) this.scrimsGuild = null

        this.scrimsGuild = (obj instanceof ScrimsGuild) ? obj : this.client.guilds.cache.get({ id_guild: this.id_guild })[0]

    }

    /**
     * @override 
     */
    updateWith(data) {

        if (data.id_type && (data.id_type != this.id_type)) {

            this.id_type = data.id_type
            this.setType(data.id_type)

        }

        if (data.id_user && (data.id_user != this.id_user)) {

            this.id_user = data.id_user
            this.setUser(data.id_user)

        }

        if (data.id_status && (data.id_status != this.id_status)) {

            this.id_status = data.id_status
            this.setStatus(data.id_status)

        }

        if (data.id_guild && (data.id_guild != this.id_guild)) {

            this.id_guild = data.id_guild
            this.setGuild(data.id_guild)

        }

        if (data.channel_id) this.channel_id = data.channel_id;

        if (data.created_at) this.created_at = data.created_at;

        return this;
        
    }

}

module.exports = ScrimsTicket;