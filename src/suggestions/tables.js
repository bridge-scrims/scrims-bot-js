const DBCache = require("../lib/postgresql/cache");
const DBTable = require("../lib/postgresql/table");
const ScrimsSuggestion = require("./suggestion");

class SuggestionsTableCache extends DBCache {

    /**
     * @override
     * @returns { ScrimsSuggestion[] }
     */
    get(...args) {

        return super.get(...args);

    }

}

class SuggestionsTable extends DBTable {


    constructor(client) {

        const foreigners = [
            [ "creator", "id_creator", "get_user_id" ],
            [ "scrimsGuild", "id_guild", "get_guild_id" ]
        ]

        super(client, "scrims_suggestion", "get_suggestions", foreigners, { defaultTTL: 7*24*60*60 }, ScrimsSuggestion);

        /**
         * @type { SuggestionsTableCache }
         */
        this.cache

    }

    /**
     * @override
     * @returns { Promise<ScrimsSuggestion[]> }
     */
    async get(...args) {

        return super.get(...args);

    }

    /**
     * @override
     * @returns { Promise<ScrimsSuggestion> }
     */
    async create(...args) {

        return super.create(...args);

    }

    /**
     * @override
     * @returns { Promise<ScrimsSuggestion[]> }
     */
    async remove(...args) {

        return super.remove(...args);

    }

    /**
     * @override
     */
    initializeListeners() {

        this.ipc.on('suggestion_remove', message => this.cache.remove(message.payload))
        this.ipc.on('suggestion_update', message => this.cache.update(message.payload.data, message.payload.selector))
        this.ipc.on('suggestion_create', message => this.cache.push(this.getRow(message.payload)))

    }
    

}

module.exports = { SuggestionsTable };