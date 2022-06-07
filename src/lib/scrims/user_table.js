const DBCache = require("../postgresql/cache");
const DBTable = require("../postgresql/table");
const ScrimsUser = require("./user");
const { validate } = require("uuid");
const { GuildMember, User } = require("discord.js");

/**
 * @extends DBCache<ScrimsUser>
 */
class ScrimsUserTableCache extends DBCache {

    constructor() {

        super({ lifeTime: -1 });

    }
    
    /** 
     * @param {import("../types").ScrimsUserResolvable} resolvable 
     * @returns {ScrimsUser}
     */
    resolve(resolvable) {

        if (resolvable instanceof ScrimsUser) return resolvable;
        if (resolvable instanceof GuildMember || resolvable instanceof User) resolvable = resolvable.id

        if (typeof resolvable === "string") {
            if (validate(resolvable)) return super.resolve(resolvable);
            else return this.filter(user => user.discord_id === resolvable)[0];
        }
        
        return null;

    }

    /** 
     * @param {import("../types").ScrimsUserResolvable} resolvable 
     * @returns {string}
     */
    resolveId(resolvable) {

        if (resolvable instanceof ScrimsUser) return resolvable.id_user;
        if ((typeof resolvable === "string") && validate(resolvable)) return resolvable;

        if (resolvable instanceof GuildMember || resolvable instanceof User) resolvable = resolvable.id
        if (typeof resolvable === "string") return this.filter(user => user.discord_id === resolvable)[0].id_user;

        return null;

    }

}

/**
 * @extends DBTable<ScrimsUser>
 */
class ScrimsUserTable extends DBTable {

    constructor(client) {

        super(client, "scrims_user", null, {}, [], ScrimsUser);
        
        /**
         * @type { ScrimsUserTableCache }
         */
        this.cache = new ScrimsUserTableCache()

    }

}

module.exports = ScrimsUserTable;

