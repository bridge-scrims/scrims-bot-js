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

    iconURL(discordClient) {

        if (!this.icon) return null;
        return discordClient.rest.cdn.Icon(this.guild_id, this.icon, undefined, undefined, true);

    }

}

module.exports = ScrimsGuild;