const { Guild, RoleResolvable } = require("discord.js");
const TableRow = require("../postgresql/row");

const ScrimsPosition = require("./position");
const ScrimsGuild = require("./guild");

class ScrimsPositionRole extends TableRow {

    static uniqueKeys = ['id_position', 'role_id', 'guild_id']
    static columns = ['id_position', 'role_id', 'guild_id']

    static sortByLevel(a, b) {

        return ((a?.position?.level ?? 99) - (b?.position?.level ?? 99));
        
    }
    
    constructor(client, positionRoleData) {

        super(client, positionRoleData)

        /** @type {number} */
        this.id_position

        /** @type {ScrimsPosition} */
        this.position

        /** @type {string} */
        this.role_id

        /** @type {string} */
        this.guild_id

        /** @type {ScrimsGuild} */
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

    /**
     * @param {string|number|Object.<string, any>|ScrimsPosition} positionResolvable 
     */
    setPosition(positionResolvable) {

        if (typeof positionResolvable === "string") positionResolvable = { name: positionResolvable }

        this._setForeignObjectReference(this.client.positions, 'position', ['id_position'], ['id_position'], positionResolvable)
        return this;

    }

    /**
     * @param {RoleResolvable} roleResolvable 
     */
    setRole(roleResolvable) {

        this.role_id = roleResolvable?.id ?? roleResolvable
        return this;

    }

    /**
     * @param {string|Object.<string, any>|ScrimsGuild|Guild} guildResolvable 
     */
    setGuild(guildResolvable) {

        if (guildResolvable instanceof Guild) guildResolvable = guildResolvable.id
        
        this._setForeignObjectReference(this.client.guilds, 'guild', ['guild_id'], ['guild_id'], guildResolvable)
        return this;

    }

    /** 
     * @override
     * @param {Object.<string, any>} guildEntryData 
     */
    update(positionRoleData) {
        
        super.update(positionRoleData);

        this.setGuild(positionRoleData.guild)
        this.setPosition(positionRoleData.position)

        return this;

    }

}

module.exports = ScrimsPositionRole;