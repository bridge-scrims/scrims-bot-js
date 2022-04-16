const { Constants } = require("discord.js");
const DBCache = require("../postgresql/cache");
const DBTable = require("../postgresql/table");

class ScrimsUserCache extends DBCache {

    /** 
     * @param { Object.<string, any> } filter
     * @param { Boolean } invert
     * @returns { ScrimsUser[] }
     */
    get(filter, invert) {

        return super.get(filter, invert);

    }

}

class ScrimsUserTable extends DBTable {

    constructor(client) {

        super(client, "scrims_user", "get_users", [], ScrimsUser, ScrimsUserCache);

        /**
         * @type { ScrimsUserCache }
         */
        this.cache

    }

    /**
     * @override
     */
    initializeListeners() {

        this.ipc.on('scrims_user_remove', message => this.cache.remove(message.payload))
        this.ipc.on('scrims_user_update', message => this.cache.update(message.payload.data, message.payload.selector))
        this.ipc.on('scrims_user_create', message => this.cache.push(this.getRow(message.payload)))

    }

    /** 
     * @param { Object.<string, any> } filter
     * @param { Boolean } useCache
     * @returns { Promise<ScrimsUser[]> }
     */
    async get(filter, useCache) {

        return super.get(filter, useCache);

    }

    /** 
     * @param { Object.<string, any> } data
     * @returns { Promise<ScrimsUser> }
     */
    async create(data) {

        return super.create(data);

    }

    /** 
     * @param { Object.<string, any> } selector
     * @returns { Promise<ScrimsUser[]> }
     */
    async remove(selector) {

        return super.remove(selector);

    }

}

class ScrimsUser extends DBTable.Row {

    /**
     * @type { ScrimsUserTable }
     */
    static Table = ScrimsUserTable

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
         * @type { String }
         */
        this.discord_discriminator = `${userData.discord_discriminator}`.padStart(4, '0');

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

    get tag() {

        if (!this.discord_username || !this.discord_discriminator) return null;
        return `${this.discord_username}#${this.discord_discriminator}`;

    }

    getMention(effect="") {

        if (this.discordUser) return `${this.discordUser}`;
        if (this.tag) return `${effect}${this.tag}${effect}`;
        return `${effect}Unknown User${effect}`;

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
        
        if (!this.discord_discriminator) return null;
        const defaultAvatar = cdn.DefaultAvatar(this.discord_discriminator % 5)

        if (!this.discord_id || !this.discord_avatar) return defaultAvatar;
        const avatar = cdn.Avatar(this.discord_id, this.discord_avatar, undefined, undefined, true)
        
        return avatar ?? defaultAvatar;

    }

}

module.exports = ScrimsUser;