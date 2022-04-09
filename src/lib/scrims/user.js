const DBTable = require("../postgresql/table");

class ScrimsUser extends DBTable.Row {

    constructor(client, userData) {

        super(client, {})

        /**
         * @type Integer
         */
        this.id_user = userData.id_user;
        
        /**
         * @type Integer
         */
        this.joined_at = userData.joined_at;


        /**
         * @type String
         */
        this.discord_id = userData.discord_id;

        /**
         * @type String
         */
        this.discord_username = userData.discord_username;

        /**
         * @type Integer
         */
        this.discord_discriminator = userData.discord_discriminator;

        /**
         * @type Integer
         */
        this.discord_accent_color = userData.discord_accent_color;

        /**
         * @type String
         */
        this.discord_avatar = userData.discord_avatar;


        /**
         * @type String
         */
        this.mc_uuid = userData.mc_uuid;

        /**
         * @type String
         */
        this.mc_name = userData.mc_name;

        /**
         * @type Boolean
         */
        this.mc_verified = userData.mc_verified;


        /**
         * @type String
         */
        this.country = userData.country;

        /**
         * @type String
         */
        this.timezone = userData.timezone;

    }

}

module.exports = ScrimsUser;