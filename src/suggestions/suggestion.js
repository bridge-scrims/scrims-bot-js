const DBCache = require("../lib/postgresql/cache");
const DBTable = require("../lib/postgresql/table");

const { Message } = require("discord.js");
const ScrimsAttachment = require("../lib/scrims/attachment");
const ScrimsGuild = require("../lib/scrims/guild");
const ScrimsUser = require("../lib/scrims/user");
const TableRow = require("../lib/postgresql/row");

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
            [ "attachment", "attachment_id", "get_attachment_id" ]
        ]

        super(client, "scrims_suggestion", "get_suggestions", foreigners, ['id_suggestion'], ScrimsSuggestion, SuggestionsTableCache);

        /**
         * @type { SuggestionsTableCache }
         */
        this.cache

    }

    /**
     * @override
     */
    initializeListeners() {

        this.ipc.on('suggestion_remove', message => this.cache.filterOut(message.payload))
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

class ScrimsSuggestion extends TableRow {

    /**
     * @type { ScrimsSuggestionsTable }
     */
    static Table = ScrimsSuggestionsTable

    constructor(table, suggestionData) {

        const references = [
            ['guild', ['guild_id'], ['guild_id'], table.client.guilds],
            ['creator', ['id_creator'], ['id_user'], table.client.users],
            ["attachment", ["attachment_id"], ["attachment_id"], table.client.attachments]
        ]

        super(table, suggestionData, references)

        /**
         * @type { string } 
         */
        this.id_suggestion
        
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
         * @type { string } 
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

        /**
         * @type { string }
         */
        this.attachment_id

        /**
         * @type { ScrimsAttachment }
         */
        this.attachment

    }

    get attachmentURL() {

        return this.attachment.url;
        
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

}

module.exports = ScrimsSuggestion;