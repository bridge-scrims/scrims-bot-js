const { Constants } = require("discord.js");
const DBTable = require("../postgresql/table");

class ScrimsUser extends DBTable.Row {

    constructor(client, userData) {

        super(client, {})

        /**
         * @type { Integer }
         */
        this.id_user = userData.id_user;
        
        /**
         * @type { Integer }
         */
        this.joined_at = userData.joined_at;


        /**
         * @type { String }
         */
        this.discord_id = userData.discord_id;

        /**
         * @type { String }
         */
        this.discord_username = userData.discord_username;

        /**
         * @type { Integer }
         */
        this.discord_discriminator = userData.discord_discriminator;

        /**
         * @type { Integer }
         */
        this.discord_accent_color = userData.discord_accent_color;

        /**
         * @type { String }
         */
        this.discord_avatar = userData.discord_avatar;


        /**
         * @type { String }
         */
        this.mc_uuid = userData.mc_uuid;

        /**
         * @type { String }
         */
        this.mc_name = userData.mc_name;

        /**
         * @type { Boolean }
         */
        this.mc_verified = userData.mc_verified;


        /**
         * @type { String }
         */
        this.country = userData.country;

        /**
         * @type { String }
         */
        this.timezone = userData.timezone;

    }

    get discordUser() {

        if (!this.discord_id) return null;
        return this.bot.users.resolve(this.discord_id);

    }

    getCurrentTime() {

        if (!this.timezone) return null;
        return moment.tz(moment(), this.timezone);        

    }

    /**
     * 
     * @returns { String } The user's avatar URL, default avatar URL or null
     */
    avatarURL() {

        const cdn = Constants.Endpoints.CDN("https://cdn.discordapp.com")
        
        const defaultAvatar = cdn.DefaultAvatar(this.discord_discriminator % 5)
        const avatar = cdn.Avatar(this.discord_id, this.discord_avatar, undefined, undefined, true)
        return avatar ?? defaultAvatar;

    }

}

module.exports = ScrimsUser;