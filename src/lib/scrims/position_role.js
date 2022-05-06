const DBTable = require("../postgresql/table");
const DBCache = require("../postgresql/cache");
const ScrimsPosition = require("./position");
const ScrimsGuild = require("./guild");
const TableRow = require("../postgresql/row");

class ScrimsPositionRolesCache extends DBCache {



}

class ScrimsPositionRolesTable extends DBTable {

    constructor(client) {

        const foreigners = [
            [ "position", "id_position", "get_position_id" ]
        ]

        const uniqueKeys = [ 'id_position', 'role_id', 'guild_id' ]

        super(client, "scrims_position_role", "get_position_roles", foreigners, uniqueKeys, ScrimsPositionRole, ScrimsPositionRolesCache);

        /**
         * @type { ScrimsPositionRolesCache }
         */
        this.cache

    }

    /**
     * @override
     */
    initializeListeners() {

        this.ipc.on('position_role_remove', message => this.cache.filterOut(message.payload))
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

class ScrimsPositionRole extends TableRow {

    /**
     * @type { ScrimsPositionRolesTable }
     */
    static Table = ScrimsPositionRolesTable

    constructor(table, positionRoleData) {

        const references = [
            ['position', ['id_position'], ['id_position'], table.client.positions], 
            ['guild', ['guild_id'], ['guild_id'], table.client.guilds]
        ]

        super(table, positionRoleData, references)

        /**
         * @type { string }
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
         * @type { string }
         */
        this.guild_id

        /**
         * @type { ScrimsGuild }
         */
        this.guild

    }

    get discordGuild() {

        if (!this.guild) return null;
        return this.guild.discordGuild;

    }

    get role() {

        if (!this.role_id || !this.discordGuild) return null;
        return this.discordGuild.roles.resolve(this.role_id);

    }

}

module.exports = ScrimsPositionRole;