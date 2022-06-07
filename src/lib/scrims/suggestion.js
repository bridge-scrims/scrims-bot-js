const { Message, Guild } = require("discord.js");

const ScrimsAttachment = require("../scrims/attachment");
const ScrimsGuild = require("../scrims/guild");
const ScrimsUser = require("../scrims/user");
const TableRow = require("../postgresql/row");

class ScrimsSuggestion extends TableRow {

    static uniqueKeys = ['id_suggestion']
    static columns = ['id_suggestion', 'guild_id', "channel_id", "message_id", "suggestion", "created_at", "id_creator", "epic", "attachment_id"]

    constructor(table, suggestionData) {

        super(table, suggestionData)

        /** @type {string} */
        this.id_suggestion
        if (!this.id_suggestion) this.setId()
        
        /** @type {string} */
        this.guild_id

        /** @type {ScrimsGuild} */
        this.guild

        /** @type {string} */
        this.channel_id

        /** @type {string} */
        this.message_id

        /** @type {string} */
        this.suggestion

        /** @type {number} */
        this.created_at

        /** @type {string} */
        this.id_creator

        /** @type {ScrimsUser} */
        this.creator

        /** @type {number} */
        this.epic

        /** @type {string} */
        this.attachment_id

        /** @type {ScrimsAttachment} */
        this.attachment

    }

    get attachmentURL() {

        return this.attachment?.url ?? null;
        
    }

    get discordGuild() {

        if (!this.guild) return null;
        return this.guild.discordGuild;

    }

    get channel() {

        if (!this.discordGuild || !this.channel_id) return null;
        return this.discordGuild.channels.resolve(this.channel_id);

    }

    /**
     * @returns { Message }
     */
    get message() {

        if (!this.channel || !this.message_id) return null;
        return this.channel.messages.resolve(this.message_id);

    }

    /**
     * @returns { Promise<Message> }
     */
    async fetchMessage() {

        if (!this.channel || !this.message_id) return null;
        return this.channel.messages.fetch(this.message_id);

    }

    isCacheExpired(now) {

        return ((now - this.created_at) > (5*24*60*60)) && super.isCacheExpired(now);
        
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
     * @param {import('discord.js').MessageResolvable} messageResolvable 
     */
    setMessage(messageResolvable) {

        this.message_id = messageResolvable?.id ?? messageResolvable
        return this;

    }

    /**
     * @param {string} suggestion
     */
    setSuggestion(suggestion) {

        this.suggestion = suggestion
        return this;

    }

    /**
     * @param {number} [created_at] if falsley will use current time 
     */
    setCreation(created_at) {

        this.created_at = created_at ?? Math.floor(Date.now()/1000)
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
     * @param {string|Object.<string, any>|ScrimsUser} userResolvable 
     */
    setCreator(userResolvable) {

        this._setForeignObjectReference(this.client.users, 'creator', ['id_creator'], ['id_user'], userResolvable)
        return this;

    }

    /**
     * @param {number} [epic] if falsley will use current time 
     */
    setEpic(epic) {

        this.epic = epic ?? Math.floor(Date.now()/1000)
        return this;

    }

    /**
     * @param {string|Object.<string, any>|ScrimsAttachment} attachmentResolvable 
     */
    setAttachment(attachmentResolvable) {

        this._setForeignObjectReference(this.client.attachments, 'attachment', ['attachment_id'], ['attachment_id'], attachmentResolvable)
        return this;

    }

    /** 
     * @override
     * @param {Object.<string, any>} ticketData 
     */
    update(suggestionData) {
        
        super.update(suggestionData);

        this.setGuild(suggestionData.guild)
        this.setCreator(suggestionData.creator)
        this.setAttachment(suggestionData.attachment)

        return this;

    }

}

module.exports = ScrimsSuggestion;