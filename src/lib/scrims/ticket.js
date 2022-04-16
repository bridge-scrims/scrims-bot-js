const DBTable = require("../postgresql/table");
const ScrimsGuild = require("./guild");
const ScrimsUser = require("./user");

class ScrimsTicket extends DBTable.Row {

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
        this.client.ticketTypes.cache.on("push", type => (type.id_type == this.id_type) ? this.setType(type) : null)

        /**
         * @type { Integer }
         */
        this.id_user = ticketData.id_user;

        /**
         * @type { ScrimsUser }
         */
        this.user
        this.setUser(ticketData.user)
        this.client.users.cache.on("push", user => (user.id_user == this.id_user) ? this.setUser(user) : null)

        /**
         * @type { Integer }
         */
        this.id_status = ticketData.id_status;

        /**
         * @type { { id_status: Integer, name: String } }
         */
        this.status
        this.setStatus(ticketData.status)
        this.client.ticketStatuses.cache.on("push", status => (status.id_status == this.id_status) ? this.setStatus(status) : null)

        /**
         * @type { Integer }
         */
        this.id_guild = ticketData.id_guild;

        /**
         * @type { ScrimsGuild }
         */
        this.scrimsGuild
        this.setGuild(ticketData.guild)
        this.client.guilds.cache.on("push", guild => (guild.id_guild == this.id_guild) ? this.setGuild(guild) : null)

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

        this.type = this.createHandle("type", this.client.ticketTypes, { id_type: this.id_type }, obj);

    }

    setUser(obj) {

        this.user = this.createHandle("user", this.client.users, { id_user: this.id_user }, obj);

    }

    setStatus(obj) {

        this.status = this.createHandle("status", this.client.ticketStatuses, { id_status: this.id_status }, obj);

    }
    
    setGuild(obj) {

        this.scrimsGuild = this.createHandle("scrimsGuild", this.client.guilds, { id_guild: this.id_guild }, obj);

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

    /**
     * @override 
     */
    close() {
        
        this.removeHandle("type", this.client.ticketTypes, { id_type: this.id_type })
        this.removeHandle("user", this.client.users, { id_user: this.id_user })
        this.removeHandle("status", this.client.ticketStatuses, { id_status: this.id_status })
        this.removeHandle("scrimsGuild", this.client.guilds, { id_guild: this.id_guild })

    }

}

module.exports = ScrimsTicket;