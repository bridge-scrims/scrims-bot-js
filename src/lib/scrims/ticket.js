const { TextChannel, Guild } = require("discord.js");
const TableRow = require("../postgresql/row");

const ScrimsTicketStatus = require("./ticket_status");
const ScrimsTicketType = require("./ticket_type");
const ScrimsGuild = require("./guild");
const ScrimsUser = require("./user");

class ScrimsTicket extends TableRow {

    static uniqueKeys = ['id_ticket']
    static columns = ['id_ticket', 'id_type', 'id_user', 'id_status', 'guild_id', 'channel_id', 'created_at', 'id_closer']

    constructor(client, ticketData) {

        super(client, ticketData)

        /** @type {number} */
        this.id_ticket
        if (!this.id_ticket) this.setId()
        
        /** @type {string} */
        this.id_type

        /** @type {ScrimsTicketType} */
        this.type

        /** @type {string} */
        this.id_user

        /** @type {ScrimsUser} */
        this.user

        /** @type {string} */
        this.id_status

        /** @type {ScrimsTicketStatus} */
        this.status

        /** @type {string} */
        this.guild_id

        /** @type {ScrimsGuild} */
        this.guild

        /** @type {string} */
        this.channel_id 

        /** @type {number} */
        this.created_at
        if (!this.created_at) this.setCreation()

        /** @type {string|null} */
        this.id_closer

        /** @type {ScrimsUser|null} */
        this.closer

    }

    isCacheExpired(now) {

        return (this.status?.name === "deleted") && super.isCacheExpired(now);
        
    }

    /**
     * @param {string} [id_ticket] if falsley will use a random uuid
     */
    setId(id_ticket) {

        this.id_ticket = id_ticket ?? this.client.generateUUID()
        return this;

    }

    /** 
     * @param {import('discord.js').ChannelResolvable} channelResolvable 
     */
    setChannel(channelResolvable) {

        this.channel_id = channelResolvable?.id ?? channelResolvable
        return this;

    }

    /**
     * @param {number} [created_at] if falsley will use current time 
     */
    setCreation(created_at) {

        this.created_at = created_at ?? Math.floor(Date.now()/1000)
        return this;

    }

    get discordGuild() {

        if (!this.guild) return null;
        return this.guild.discordGuild;

    }

    /** @returns {TextChannel} */
    get channel() {

        if (!this.channel_id || !this.bot) return null;
        return this.bot.channels.resolve(this.channel_id);

    }

    /** @returns {Promise<TextChannel>} */
    async fetchChannel() {

        if (!this.discordGuild) return null;
        return this.discordGuild.channels.fetch(this.channel_id).catch(() => null);

    }

    /**
     * @param {number|string|Object.<string, any>|ScrimsTicketType} typeResolvable 
     */
    setType(typeResolvable) {

        if (typeof typeResolvable === "string") typeResolvable = { name: typeResolvable }

        this._setForeignObjectReference(this.client.ticketTypes, 'type', ['id_type'], ['id_type'], typeResolvable)
        return this;

    }

    /**
     * @param {number|string|Object.<string, any>|ScrimsTicketStatus} statusResolvable 
     */
    setStatus(statusResolvable) {

        if (typeof statusResolvable === "string") statusResolvable = { name: statusResolvable }
        
        this._setForeignObjectReference(this.client.ticketStatuses, 'status', ['id_status'], ['id_status'], statusResolvable)
        return this;

    }

    /**
     * @param {string|Object.<string, any>|ScrimsUser} userResolvable 
     */
    setUser(userResolvable) {

        this._setForeignObjectReference(this.client.users, 'user', ['id_user'], ['id_user'], userResolvable)
        return this;

    }

    /**
     * @param {string|Object.<string, any>|ScrimsUser} userResolvable 
     */
    setCloser(userResolvable) {

        this._setForeignObjectReference(this.client.users, 'closer', ['id_closer'], ['id_user'], userResolvable)
        return this;

    }

    /**
     * @param {string|Object.<string, any>|ScrimsGuild|Guild} guildResolvable 
     */
    setGuild(guildResolvable) {

        if (guildResolvable instanceof Guild) guildResolvable = guildResolvable.id

        this._setForeignObjectReference(this.client.guilds, 'guild', ['guild_id'], ['guild_id'], guildResolvable)
        return this;

    }

    /** 
     * @override
     * @param {Object.<string, any>} ticketData 
     */
    update(ticketData) {
        
        super.update(ticketData);

        this.setType(ticketData.type)
        this.setStatus(ticketData.status)
        this.setCloser(ticketData.closer)
        this.setUser(ticketData.user)
        this.setGuild(ticketData.guild)

        return this;

    }

}

module.exports = ScrimsTicket;