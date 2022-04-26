const DBCache = require("../postgresql/cache");
const TableRow = require("../postgresql/row");
const DBTable = require("../postgresql/table");
const ScrimsGuild = require("./guild");
const ScrimsGuildEntryType = require("./guild_entry_type");

class ScrimsGuildEntrysCache extends DBCache {

    /** 
     * @param { Object.<string, any> } filter
     * @param { Boolean } invert
     * @returns { ScrimsGuildEntry[] }
     */
    get(filter, invert) {

        return super.get(filter, invert);

    }

}

class ScrimsGuildEntrysTable extends DBTable {

    constructor(client) {

        const foreigners = [
            [ "type", "id_type", "get_guild_entry_type_id" ]
        ]

        super(client, "scrims_guild_entry", "get_guild_entrys", foreigners, ['guild_id', 'id_type'], ScrimsGuildEntry, ScrimsGuildEntrysCache);

        /**
         * @type { ScrimsGuildEntrysCache }
         */
        this.cache

    }

    /**
     * @override
     */
    initializeListeners() {

        this.ipc.on('guild_entry_remove', message => this.cache.remove(message.payload))
        this.ipc.on('guild_entry_update', message => this.cache.update(message.payload.data, message.payload.selector))
        this.ipc.on('guild_entry_create', message => this.cache.push(this.getRow(message.payload)))

    }
    
    /** 
     * @param { Object.<string, any> } filter
     * @param { Boolean } useCache
     * @returns { Promise<ScrimsGuildEntry[]> }
     */
    async get(filter, useCache) {

        return super.get(filter, useCache);

    }

    /** 
     * @param { Object.<string, any> } data
     * @returns { Promise<ScrimsGuildEntry> }
     */
    async create(data) {

        return super.create(data);

    }

    /**
     * @param { Object.<string, any> } selector
     * @returns { Promise<ScrimsGuildEntry[]> }
     */
    async remove(selector) {

        return super.remove(selector);

    }

}

class ScrimsGuildEntry extends TableRow {

    /**
     * @type { ScrimsGuildEntrysTable }
     */
    static Table = ScrimsGuildEntrysTable
    
    constructor(table, entryData) {

        const references = [
            ['guild', ['guild_id'], ['guild_id'], table.client.guilds], 
            ['type', ['id_type'], ['id_type'], table.client.guildEntryTypes]
        ]

        super(table, entryData, references);

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
        this.id_type

        /**
         * @type { ScrimsGuildEntryType }
         */
        this.type
 
        /**
         * @type { string }
         */
        this.value

    }

    get discordGuild() {

        if (!this.guild) return null;
        return this.guild.discordGuild;

    }

}

module.exports = ScrimsGuildEntry;