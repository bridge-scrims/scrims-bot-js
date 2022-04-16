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
            [ "scrimsGuild", "id_guild", "get_guild_id" ]
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

        super(client, {})

        /**
         * @type { Integer }
         */
        this.id_position = positionRoleData.id_position;

        /**
         * @type { ScrimsPosition }
         */
        this.position
        this.setPosition(positionRoleData.position)

        /**
         * @type { String }
         */
        this.role_id = positionRoleData.role_id;

        /**
         * @type { Integer }
         */
        this.id_guild = positionRoleData.id_guild;

        /**
         * @type { ScrimsGuild }
         */
        this.scrimsGuild
        this.setScrimsGuild(positionRoleData.guild)

    }

    get guild() {

        if (!this.scrimsGuild) return null;
        return this.scrimsGuild.guild;

    }

    get guild_id() {

        if (!this.scrimsGuild) return null;
        return this.scrimsGuild.discord_id;

    }

    get role() {

        if (!this.role_id || !this.guild) return null;
        return this.guild.roles.resolve(this.role_id);

    }

    setPosition(obj) {

        if (obj === null) this.position = null

        this.position = (obj instanceof ScrimsPosition) ? obj : this.client.positions.cache.get({ id_position: this.id_position })[0]

    }

    setScrimsGuild(obj) {

        if (obj === null) this.scrimsGuild = null

        this.scrimsGuild = (obj instanceof ScrimsGuild) ? obj : this.client.guilds.cache.get({ id_guild: this.id_guild })[0]

    }

    /**
     * @override 
     */
    updateWith(data) {

        if (data.id_position && (data.id_position != this.id_position)) {

            this.id_position = data.id_position
            this.setPosition(data.position)

        }

        if (data.role_id) this.role_id = data.role_id;
        
        if (data.id_guild && (data.id_guild != this.id_guild)) {

            this.id_guild = data.id_guild
            this.setScrimsGuild(data.guild)

        }

        return this;
        
    }

}

module.exports = ScrimsPositionRole;