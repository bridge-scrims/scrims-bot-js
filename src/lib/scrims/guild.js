const { Constants } = require("discord.js");
const TableRow = require("../postgresql/row");

class ScrimsGuild extends TableRow {

    static uniqueKeys = ['guild_id']
    static columns = ['guild_id', 'name', 'icon']

    /**
     * @param {import("discord.js").Guild} guild 
     */
    static fromDiscordGuild(guild) {

        return new ScrimsGuild(guild.client.database, { guild_id: guild.id, name: guild.name, icon: (guild.icon ?? null) });

    }

    constructor(client, guildData) {

        super(client, guildData);

        /** @type {string} */
        this.guild_id

        /** @type {string} */
        this.name

        /** @type {string} */
        this.icon

    }

    get id() {

        return this.guild_id;

    }

    get discordGuild() {

        if (!this.guild_id || !this.bot) return null;
        return this.bot.guilds.resolve(this.guild_id);

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