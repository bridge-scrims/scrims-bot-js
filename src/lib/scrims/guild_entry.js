const DBCache = require("../postgresql/cache");
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
            [ "type", "id_type", "get_guild_entry_type_id" ],
            [ "scrimsGuild", "id_guild", "get_guild_id" ]
        ]

        super(client, "scrims_guild_entry", "get_guild_entrys", foreigners, ScrimsGuildEntry, ScrimsGuildEntrysCache);

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

class ScrimsGuildEntry extends DBTable.Row {

    /**
     * @type { ScrimsGuildEntrysTable }
     */
    static Table = ScrimsGuildEntrysTable
    
    constructor(client, entryData) {

        super(client, {});

        /**
         * @type { Integer }
         */
        this.id_guild = entryData.id_guild

        /**
         * @type { ScrimsGuild }
         */
        this.scrimsGuild
        this.setScrimsGuild(entryData.guild)

        /**
         * @type { Integer }
         */
        this.id_type = entryData.id_type

        /**
         * @type { ScrimsGuildEntryType }
         */
        this.type
        this.setType(entryData.type)
 
        /**
         * @type { String }
         */
        this.value = entryData.value

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

    setType(obj) {

        if (obj === null) this.type = null

        this.type = (obj instanceof ScrimsGuildEntryType) ? obj : this.client.guildEntryTypes.cache.get({ id_type: this.id_type })[0]

    }

    /**
     * @override 
     */
    updateWith(data) {

        if (data.id_guild && (data.id_guild != this.id_guild)) {

            this.id_guild = data.id_guild
            this.setScrimsGuild(data.guild)

        }

        if (data.id_type && (data.id_type != this.id_type)) {

            this.id_type = data.id_type
            this.setType(data.type)

        }

        if (data.value) this.value = data.value;

        return this;
        
    }

}

module.exports = ScrimsGuildEntry;