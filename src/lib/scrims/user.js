const { Constants } = require("discord.js");
const DBCache = require("../postgresql/cache");
const DBTable = require("../postgresql/table");

class ScrimsUserCache extends DBCache {


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

        this.ipc.on('scrims_user_remove', message => this.cache.filterOut(message.payload))
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

        super(client, userData, [])

        /**
         * @type { number }
         */
        this.id_user

        /**
         * @type { number }
         */
        this.joined_at

        /**
         * @type { string }
         */
        this.discord_id

        /**
         * @type { string }
         */
        this.discord_username

        /**
         * @type { string }
         */
        this.discord_discriminator = `${userData.discord_discriminator}`.padStart(4, '0')

        /**
         * @type { number }
         */
        this.discord_accent_color

        /**
         * @type { string }
         */
        this.discord_avatar

        /**
         * @type { string }
         */
        this.mc_uuid

        /**
         * @type { string }
         */
        this.mc_name

        /**
         * @type { boolean }
         */
        this.mc_verified

        /**
         * @type { string }
         */
        this.country

        /**
         * @type { string }
         */
        this.timezone

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
        if (this.tag) return `${effect}@${this.tag}${effect}`;
        return `${effect}@unknown-user${effect}`;

    }

    getCurrentTime() {

        if (!this.timezone) return null;
        return moment.tz(moment(), this.timezone);        

    }

    /**
     * 
     * @returns { string } The user's avatar URL, default avatar URL or null
     */
    avatarURL() {

        const cdn = Constants.Endpoints.CDN("https://cdn.discordapp.com")
        
        if (!this.discord_discriminator) return null;
        const defaultAvatar = cdn.DefaultAvatar(this.discord_discriminator % 5)

        if (!this.discord_id || !this.discord_avatar) return defaultAvatar;
        const avatar = cdn.Avatar(this.discord_id, this.discord_avatar, undefined, undefined, true)
        
        return avatar ?? defaultAvatar;

    }

    /**
     * @override
     * @param { Object.<string, any> } obj 
     * @returns { Boolean }
     */
    equals(obj) {

        if (obj instanceof ScrimsUser) {

            return (obj.id_user === this.id_user);

        }
        
        return this.valuesMatch(obj, this);

    }

}

module.exports = ScrimsUser;