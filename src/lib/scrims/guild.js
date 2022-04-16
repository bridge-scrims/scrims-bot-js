const { Constants } = require("discord.js");
const DBCache = require("../postgresql/cache");
const DBTable = require("../postgresql/table");

class ScrimsGuildCache extends DBCache {

    /** 
     * @param { Object.<string, any> } filter
     * @param { Boolean } invert
     * @returns { ScrimsGuild[] }
     */
    get(filter, invert) {

        return super.get(filter, invert);

    }

}

class ScrimsGuildTable extends DBTable {

    constructor(client) {

        super(client, "scrims_guild", null, [], ScrimsGuild, ScrimsGuildCache);

        /**
         * @type { ScrimsGuildCache }
         */
        this.cache

    }

    /**
     * @override
     */
    initializeListeners() {

        this.ipc.on('guild_remove', message => this.cache.remove(message.payload))
        this.ipc.on('guild_update', message => this.cache.update(message.payload.data, message.payload.selector))
        this.ipc.on('guiöd_create', message => this.cache.push(this.getRow(message.payload)))

    }

    /** 
     * @param { Object.<string, any> } filter
     * @param { Boolean } useCache
     * @returns { Promise<ScrimsGuild[]> }
     */
    async get(filter, useCache) {

        return super.get(filter, useCache);

    }

    /** 
     * @param { Object.<string, any> } data
     * @returns { Promise<ScrimsGuild> }
     */
    async create(data) {

        return super.create(data);

    }

    /** 
     * @param { Object.<string, any> } selector
     * @returns { Promise<ScrimsGuild[]> }
     */
    async remove(selector) {

        return super.remove(selector);

    }

}

class ScrimsGuild extends DBTable.Row {

    /**
     * @type { ScrimsGuildTable }
     */
    static Table = ScrimsGuildTable

    constructor(client, guildData) {

        super(client, {});

        /**
         * @type { Integer }
         */
        this.id_guild = guildData.id_guild

        /**
         * @type { String }
         */
        this.discord_id = guildData.discord_id

        /**
         * @type { String }
         */
        this.name = guildData.name

        /**
         * @type { String }
         */
        this.icon = guildData.icon

    }

    get id() {

        return this.discord_id;

    }

    get guild() {

        if (!this.discord_id) return null;
        return this.bot.guilds.resolve(this.discord_id);

    }

    /**
     * 
     * @returns { String } The guild's icon URL or null
     */
    iconURL() {

        if (!this.icon) return null;

        const cdn = Constants.Endpoints.CDN("https://cdn.discordapp.com")
        return cdn.Icon(this.discord_id, this.icon, undefined, undefined, true);

    }

}

module.exports = ScrimsGuild;