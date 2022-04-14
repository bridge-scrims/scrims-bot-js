const { Constants } = require("discord.js");
const DBTable = require("../postgresql/table");

class ScrimsGuild extends DBTable.Row {

    constructor(client, guildData) {

        super(client, {});

        /**
         * @type { Integer }
         */
        this.id_guild = guildData.id_guild

        /**
         * @type { String }
         */
        this.discord_id = guildData.discord_id

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

        return this.discord_id;

    }

    get guild() {

        if (!this.discord_id) return null;
        return this.bot.guilds.resolve(this.discord_id);

    }

    /**
     * 
     * @returns { String } The guild's icon URL or null
     */
    iconURL() {

        if (!this.icon) return null;

        const cdn = Constants.Endpoints.CDN("https://cdn.discordapp.com")
        return cdn.Icon(this.discord_id, this.icon, undefined, undefined, true);

    }

}

module.exports = ScrimsGuild;