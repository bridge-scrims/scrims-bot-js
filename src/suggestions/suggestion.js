const DBCache = require("../lib/postgresql/cache");
const DBTable = require("../lib/postgresql/table");

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

        super(client, {})

        /**
         * @type { Integer } 
         */
        this.id_suggestion = suggestionData.id_suggestion;
        
        /**
         * @type { Integer }
         */
        this.id_guild = suggestionData.id_guild;

        /**
         * @type { ScrimsGuild }
         */
        this.scrimsGuild
        this.setScrimsGuild(suggestionData.guild)

        /**
         * @type { String } 
         */
        this.channel_id = suggestionData.channel_id;

        /**
         * @type { String } 
         */
        this.message_id = suggestionData.message_id;

        /**
         * @type { String } 
         */
        this.suggestion = suggestionData.suggestion;

        /**
         * @type { Integer } 
         */
        this.created_at = suggestionData.created_at;

        /**
         * @type { Integer } 
         */
        this.id_creator = suggestionData.id_creator;

        /**
         * @type { ScrimsUser }
         */
        this.creator
        this.setCreator(suggestionData.creator)

        /**
         * @type { Integer } 
         */
        this.epic = suggestionData.epic;

    }

    get guild() {

        if (!this.scrimsGuild) return null;
        return this.scrimsGuild.guild;

    }

    get guild_id() {

        if (!this.scrimsGuild) return null;
        return this.scrimsGuild.discord_id;

    }

    setScrimsGuild(obj) {

        if (obj === null) this.scrimsGuild = null

        this.scrimsGuild = (obj instanceof ScrimsGuild) ? obj : this.client.guilds.cache.get({ id_guild: this.id_guild })[0]

    }

    setCreator(obj) {

        if (obj === null) this.creator = null

        this.creator = (obj instanceof ScrimsUser) ? obj : this.client.users.cache.get({ id_user: this.id_creator })[0]

    }

    /**
     * @override 
     */
    updateWith(data) {

        if (data.id_creator && (data.id_creator != this.id_creator)) {

            this.id_creator = data.id_creator
            this.setCreator(data.creator)

        }

        if (data.id_guild && (data.id_guild != this.id_guild)) {

            this.id_guild = data.id_guild
            this.setScrimsGuild(data.guild)

        }

        if (data.channel_id) this.channel_id = data.channel_id;
        
        if (data.message_id) this.message_id = data.message_id;

        if (data.suggestion) this.suggestion = data.suggestion;

        if (data.created_at) this.created_at = data.created_at;

        if (data.epic) this.epic = data.epic;
        
        return this;
        
    }

}

module.exports = ScrimsSuggestion;