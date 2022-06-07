const TableRow = require("../postgresql/row");

const ScrimsGuildEntryType = require("./guild_entry_type");
const ScrimsGuild = require("./guild");

class ScrimsGuildEntry extends TableRow {

    static uniqueKeys = ['guild_id', "id_type"]
    static columns = ['guild_id', 'id_type', 'value']

    constructor(client, entryData) {

        super(client, entryData);

        /** @type {string} */
        this.guild_id

        /** @type {ScrimsGuild} */
        this.guild

        /** @type {number} */
        this.id_type

        /** @type {ScrimsGuildEntryType} */
        this.type
 
        /** @type {string} */
        this.value

    }

    get discordGuild() {

        if (!this.guild) return null;
        return this.guild.discordGuild;

    }

    /**
     * @param {string|Object.<string, any>|ScrimsGuild|import("discord.js").BaseGuild} guildResolvable 
     */
    setGuild(guildResolvable) {

        guildResolvable = guildResolvable?.id ?? guildResolvable

        this._setForeignObjectReference(this.client.guilds, 'guild', ['guild_id'], ['guild_id'], guildResolvable)
        return this;

    }

    /**
     * @param {number|string|Object.<string, any>|ScrimsGuildEntryType} statusResolvable 
     */
    setType(typeResolvable) {

        if (typeof typeResolvable === "string") typeResolvable = { name: typeResolvable }
        
        this._setForeignObjectReference(this.client.guildEntryTypes, 'type', ['id_type'], ['id_type'], typeResolvable)
        return this;

    }

    /**
     * @param {string} value 
     */
    setValue(value) {

        this.value = value
        return this;

    }

    /** 
     * @override
     * @param {Object.<string, any>} guildEntryData 
     */
    update(guildEntryData) {
        
        super.update(guildEntryData);

        this.setGuild(guildEntryData.guild)
        this.setType(guildEntryData.type)

        return this;

    }

}

module.exports = ScrimsGuildEntry;