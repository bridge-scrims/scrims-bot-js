const DBCache = require("../lib/postgresql/cache");
const DBTable = require("../lib/postgresql/table");

const { Message } = require("discord.js");
const ScrimsGuild = require("../lib/scrims/guild");
const ScrimsUser = require("../lib/scrims/user");

class SuggestionsTableCache extends DBCache {

    /**
     * @returns { ScrimsSuggestion[] }
     */
    get(...args) {

        return super.get(...args);

    }

}

class ScrimsSuggestionsTable extends DBTable {

    constructor(client) {

        const foreigners = [
            [ "creator", "id_creator", "get_user_id" ],
            [ "scrimsGuild", "id_guild", "get_guild_id" ]
        ]

        super(client, "scrims_suggestion", "get_suggestions", foreigners, ScrimsSuggestion, SuggestionsTableCache);

        /**
         * @type { SuggestionsTableCache }
         */
        this.cache

    }

    /**
     * @override
     */
    initializeListeners() {

        this.ipc.on('suggestion_remove', message => this.cache.remove(message.payload))
        this.ipc.on('suggestion_update', message => this.cache.update(message.payload.data, message.payload.selector))
        this.ipc.on('suggestion_create', message => this.cache.push(this.getRow(message.payload)))

    }

    /** 
     * @param { Object.<string, any> } filter
     * @param { Boolean } useCache
     * @returns { Promise<ScrimsSuggestion[]> }
     */
     async get(filter, useCache) {

        return super.get(filter, useCache);

    }

    /** 
     * @param { Object.<string, any> } data
     * @returns { Promise<ScrimsSuggestion> }
     */
    async create(data) {

        return super.create(data);

    }

    /** 
     * @param { Object.<string, any> } selector
     * @returns { Promise<ScrimsSuggestion[]> }
     */
    async remove(selector) {

        return super.remove(selector);

    }
    
}

class ScrimsSuggestion extends DBTable.Row {

    /**
     * @type { ScrimsSuggestionsTable }
     */
    static Table = ScrimsSuggestionsTable

    constructor(client, suggestionData) {

        const references = [
            ['guild', ['id_guild'], ['id_guild'], client.guilds],
            ['creator', ['id_creator'], ['id_user'], client.users]
        ]

        super(client, suggestionData, references)

        /**
         * @type { number } 
         */
        this.id_suggestion
        
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
         * @type { string } 
         */
        this.message_id

        /**
         * @type { string } 
         */
        this.suggestion

        /**
         * @type { number } 
         */
        this.created_at

        /**
         * @type { number } 
         */
        this.id_creator

        /**
         * @type { ScrimsUser }
         */
        this.creator

        /**
         * @type { number } 
         */
        this.epic

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

}

module.exports = ScrimsSuggestion;