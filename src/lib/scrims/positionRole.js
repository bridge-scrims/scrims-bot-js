const DBTable = require("../postgresql/table");
const ScrimsPosition = require("./position");
const ScrimsGuild = require("./guild");

class ScrimsPositionRole extends DBTable.Row {

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
        this.client.positions.cache.on("push", position => (position.id_position == this.id_position) ? this.setPosition(position) : null)

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
        this.client.guilds.cache.on("push", guild => (guild.id_guild == this.id_guild) ? this.setScrimsGuild(guild) : null)

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

        this.position = this.createHandle("position", this.client.positions, { id_position: this.id_position }, obj);

    }

    setScrimsGuild(obj) {

        this.scrimsGuild = this.createHandle("guild", this.client.guilds, { id_guild: this.id_guild }, obj);

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

    /**
     * @override 
     */
    close() {
        
        this.removeHandle("position", this.client.positions, { id_position: this.id_position })
        this.removeHandle("guild", this.client.guilds, { id_guild: this.id_guild })
        
    }

}

module.exports = ScrimsPositionRole;