const DBTable = require("../postgresql/table");
const DBCache = require("../postgresql/cache");
const ScrimsPosition = require("./position");
const ScrimsGuild = require("./guild");

class ScrimsPositionRolesCache extends DBCache {

    /** 
     * @param { Object.<string, any> } filter
     * @param { Boolean } invert
     * @returns { ScrimsPositionRole[] }
     */
    get(filter, invert) {

        return super.get(filter, invert);

    }

}

class ScrimsPositionRolesTable extends DBTable {

    constructor(client) {

        const foreigners = [
            [ "position", "id_position", "get_position_id" ],
            [ "guild", "id_guild", "get_guild_id" ]
        ]

        super(client, "scrims_position_role", "get_position_roles", foreigners, ScrimsPositionRole, ScrimsPositionRolesCache);

        /**
         * @type { ScrimsPositionRolesCache }
         */
        this.cache

    }

    /**
     * @override
     */
    initializeListeners() {

        this.ipc.on('position_role_remove', message => this.cache.remove(message.payload))
        this.ipc.on('position_role_update', message => this.cache.update(message.payload.data, message.payload.selector))
        this.ipc.on('position_role_create', message => this.cache.push(this.getRow(message.payload)))

    }
    
    /** 
     * @param { Object.<string, any> } filter
     * @param { Boolean } useCache
     * @returns { Promise<ScrimsPositionRole[]> }
     */
    async get(filter, useCache) {

        return super.get(filter, useCache);

    }

    /** 
     * @param { Object.<string, any> } data
     * @returns { Promise<ScrimsPositionRole> }
     */
    async create(data) {

        return super.create(data);

    }

    /** 
     * @param { Object.<string, any> } selector
     * @returns { Promise<ScrimsPositionRole[]> }
     */
    async remove(selector) {

        return super.remove(selector);

    }

}

class ScrimsPositionRole extends DBTable.Row {

    /**
     * @type { ScrimsPositionRolesTable }
     */
    static Table = ScrimsPositionRolesTable

    constructor(client, positionRoleData) {

        const references = [
            ['position', ['id_position'], ['id_position'], client.positions], 
            ['guild', ['id_guild'], ['id_guild'], client.guilds]
        ]

        super(client, positionRoleData, references)

        /**
         * @type { number }
         */
        this.id_position

        /**
         * @type { ScrimsPosition }
         */
        this.position

        /**
         * @type { string }
         */
        this.role_id

        /**
         * @type { number }
         */
        this.id_guild

        /**
         * @type { ScrimsGuild }
         */
        this.guild

    }

    get discordGuild() {

        if (!this.guild) return null;
        return this.guild.discordGuild;

    }

    get guild_id() {

        if (!this.guild) return null;
        return this.guild.discord_id;

    }

    get role() {

        if (!this.role_id || !this.discordGuild) return null;
        return this.discordGuild.roles.resolve(this.role_id);

    }

}

module.exports = ScrimsPositionRole;