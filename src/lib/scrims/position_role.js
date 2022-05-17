const DBTable = require("../postgresql/table");
const ScrimsPosition = require("./position");
const ScrimsGuild = require("./guild");
const TableRow = require("../postgresql/row");

/**
 * @extends DBTable<ScrimsPositionRole>
 */
class ScrimsPositionRolesTable extends DBTable {

    constructor(client) {

        const foreigners = [
            [ "position", "id_position", "get_position_id" ]
        ]

        const uniqueKeys = [ 'id_position', 'role_id', 'guild_id' ]

        super(client, "scrims_position_role", "get_position_roles", foreigners, uniqueKeys, ScrimsPositionRole);

    }

    /**
     * @override
     */
    initializeListeners() {

        this.ipc.on('position_role_remove', message => this.cache.filterOut(message.payload))
        this.ipc.on('position_role_update', message => this.cache.update(message.payload.data, message.payload.selector))
        this.ipc.on('position_role_create', message => this.cache.push(this.getRow(message.payload)))

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