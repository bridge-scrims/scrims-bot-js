const DBTable = require("../postgresql/table");
const ScrimsGuild = require("./guild");

class ScrimsGuildEntry extends DBTable.Row {

    constructor(client, entryData) {

        super(client, {});

        /**
         * @type { String }
         */
        this.guild_id = entryData.guild_id

        this.guild = this.getGuild(entryData.guild)

        /**
         * @type { Integer }
         */
        this.id_type = entryData.id_type

        this.type = this.getType(entryData.type)

        /**
         * @type { String }
         */
        this.value = entryData.value

    }

    /**
     * @override 
     */
    updateWith(data) {

        if (data.guild && (data.guild_id != this.guild_id)) {

            this.removeGuildHandle()

            this.guild_id = data.guild.guild_id
            this.guild = this.getGuild(data.guild)

        }

        if (data.type && (data.id_type != this.id_type)) {

            this.removeTypeHandle()

            this.id_type = data.type.id_type
            this.type = this.getType(data.type)

        }

        if (data.value) this.value = data.value;

        return this;
        
    }

    /**
     * @override 
     */
    close() {
        
        this.removeGuildHandle()
        this.removeTypeHandle()
        
    }

    removeGuildHandle() {

        if (this.guild && this.__guildHandleId) 
            this.client.guilds.cache.removeHandle({ guild_id: this.guild.guild_id }, this.__guildHandleId)

    }

    removeTypeHandle() {

        if (this.type && this.__typeHandleId) 
            this.client.guildEntryTypes.cache.removeHandle({ id_type: this.type.id_type }, this.__typeHandleId)

    }

    getGuild(guildData) {

        if (!guildData) return null;

        const cachedGuild = this.client.guilds.cache.get({ guild_id: guildData.guild_id })[0]
        if (cachedGuild) {

            this.__guildHandleId = this.client.guilds.cache.addHandle({ guild_id: guildData.guild_id })
            if (!this.__guildHandleId) return null;

            return cachedGuild;

        }

        const newGuild = new ScrimsGuild(this.client, guildData)
        
        this.__guildHandleId = 1
        this.client.guilds.cache.push(newGuild, 0, [this.__guildHandleId])    
        
        return newGuild;

    }

    getType(typeData) {

        if (!typeData) return null;

        const cachedType = this.client.guildEntryTypes.cache.get({ id_type: typeData.id_type })[0]
        if (cachedType) {

            this.__typeHandleId = this.client.guildEntryTypes.cache.addHandle({ id_type: typeData.id_type })
            if (!this.__typeHandleId) return null;

            return cachedType;

        }

        const newType = new DBTable.Row(this.client, typeData)
        
        this.__typeHandleId = 1
        this.client.guildEntryTypes.cache.push(newType, 0, [this.__typeHandleId])    
        
        return newType;

    }

}

module.exports = ScrimsGuildEntry;