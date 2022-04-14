const DBTable = require("../postgresql/table");
const ScrimsGuild = require("./guild");

class ScrimsGuildEntry extends DBTable.Row {

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
        this.client.guilds.cache.on("push", guild => (guild.id_guild == this.id_guild) ? this.setScrimsGuild(guild) : null)

        /**
         * @type { Integer }
         */
        this.id_type = entryData.id_type

        /**
         * @type { { id_type: Integer, name: String } }
         */
        this.type
        this.setType(entryData.type)
        this.client.guildEntryTypes.cache.on("push", type => (type.id_type == this.id_type) ? this.setType(type) : null)

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

        this.scrimsGuild = this.createHandle("guild", this.client.guilds, { id_guild: this.id_guild }, obj);

    }

    setType(obj) {

        this.type = this.createHandle("type", this.client.guildEntryTypes, { id_type: this.id_type }, obj);

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

    /**
     * @override 
     */
    close() {
        
        this.removeHandle("guild", this.client.guilds, { id_guild: this.id_guild })
        this.removeHandle("type", this.client.guildEntryTypes, { id_type: this.id_type })
        
    }

}

module.exports = ScrimsGuildEntry;