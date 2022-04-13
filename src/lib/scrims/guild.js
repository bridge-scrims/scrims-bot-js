const { Constants } = require("discord.js");
const DBTable = require("../postgresql/table");

class ScrimsGuild extends DBTable.Row {

    constructor(client, guildData) {

        super(client, {});

        /**
         * @type { Integer }
         */
        this.guild_id = guildData.guild_id

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

        return this.guild_id;

    }

    /**
     * 
     * @returns { String } The guild's icon URL or null
     */
    iconURL() {

        if (!this.icon) return null;

        const cdn = Constants.Endpoints.CDN("https://cdn.discordapp.com")
        return cdn.Icon(this.guild_id, this.icon, undefined, undefined, true);

    }

}

module.exports = ScrimsGuild;