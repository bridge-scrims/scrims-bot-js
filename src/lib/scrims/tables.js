const ScrimsPositionRole = require("./positionRole");
const ScrimsUserPosition = require("./userPosition");
const ScrimsGuildEntry = require("./guild_entry");
const ScrimsPosition = require("./position");
const ScrimsGuild = require("./guild");
const ScrimsUser = require("./user");

const DBTable = require("../postgresql/table");
const DBCache = require("../postgresql/cache");

class ScrimsGuildCache extends DBCache {

    /** 
     * @param { { [s: string]: any } } filter
     * @param { Boolean } invert
     * @returns { ScrimsGuild[] }
     */
    get(filter, invert) {

        return super.get(filter, invert);

    }

}

class ScrimsGuildTable extends DBTable {

    constructor(client) {

        super(client, "scrims_guild", null, [], { defaultTTL: -1, maxKeys: -1 }, ScrimsGuild);

        /**
         * @type { ScrimsGuildCache }
         */
        this.cache

    }

    /** 
     * @param { { [s: string]: any } } filter
     * @param { Boolean } invert
     * @returns { Promise<ScrimsGuild[]> }
     */
    async get(filter, invert) {

        return super.get(filter, invert);

    }

    /** 
     * @param { { [s: string]: any } } data
     * @returns { Promise<ScrimsGuild> }
     */
    async create(data) {

        return super.create(data);

    }

    /** 
     * @param { { [s: string]: any } } selector
     * @returns { Promise<ScrimsGuild[]> }
     */
    async remove(selector) {

        return super.remove(selector);

    }

}

class ScrimsUserCache extends DBCache {

    /** 
     * @param { { [s: string]: any } } filter
     * @param { Boolean } invert
     * @returns { ScrimsUser[] }
     */
    get(filter, invert) {

        return super.get(filter, invert);

    }

}

class ScrimsUserTable extends DBTable {

    constructor(client) {

        super(client, "scrims_user", "get_users", [], {}, ScrimsUser);

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
     * @param { { [s: string]: any } } filter
     * @param { Boolean } invert
     * @returns { Promise<ScrimsUser[]> }
     */
    async get(filter, invert) {

        return super.get(filter, invert);

    }

    /** 
     * @param { { [s: string]: any } } data
     * @returns { Promise<ScrimsUser> }
     */
    async create(data) {

        return super.create(data);

    }

    /** 
     * @param { { [s: string]: any } } selector
     * @returns { Promise<ScrimsUser[]> }
     */
    async remove(selector) {

        return super.remove(selector);

    }

}

class ScrimsPositionCache extends DBCache {

    /** 
     * @param { { [s: string]: any } } filter
     * @param { Boolean } invert
     * @returns { ScrimsPosition[] }
     */
    get(filter, invert) {

        return super.get(filter, invert);

    }

}

class ScrimsPositionTable extends DBTable {

    constructor(client) {

        super(client, "scrims_position", "get_positions", [], { defaultTTL: -1, maxKeys: -1 }, ScrimsPosition);

        /**
         * @type { ScrimsPositionCache }
         */
        this.cache
        
    }

    /** 
     * @param { { [s: string]: any } } filter
     * @param { Boolean } invert
     * @returns { Promise<ScrimsPosition[]> }
     */
    async get(filter, invert) {

        return super.get(filter, invert);

    }

    /** 
     * @param { { [s: string]: any } } data
     * @returns { Promise<ScrimsPosition> }
     */
    async create(data) {

        return super.create(data);

    }

    /** 
     * @param { { [s: string]: any } } selector
     * @returns { Promise<ScrimsPosition[]> }
     */
    async remove(selector) {

        return super.remove(selector);

    }

}

class ScrimsUserPositionCache extends DBCache {

    /**
     * @override
     * @param { { [s: string]: any } } filter
     * @param { Boolean } invert
     * @returns { ScrimsUserPosition[] }
     */
    get(filter, invert) {

        // Get them expired boys out of here
        const expired = this.getEntrys().filter(([ _, userPos ]) => userPos.expires_at !== null && userPos.expires_at <= (Date.now()/1000))
        
        expired.forEach(([ _, value ]) => this.emit('remove', value))
        expired.forEach(([ key, _ ]) => this.del(key))

        return super.get(filter, invert);

    }

}

class ScrimsUserPositionsTable extends DBTable {

    constructor(client) {

        const foreigners = [
            [ "executor", "id_executor", "get_user_id" ], 
            [ "user", "id_user", "get_user_id" ], 
            [ "position", "id_position", "get_position_id" ] 
        ]

        super(client, "scrims_user_position", "get_user_positions", foreigners, {}, ScrimsUserPosition);
        
        /**
         * @type { ScrimsUserPositionCache }
         */
        this.cache = new ScrimsUserPositionCache(3600, 5000)

    }

    /**
     * @override
     */
    initializeListeners() {

        this.ipc.on('user_position_remove', message => this.cache.remove(message.payload))
        this.ipc.on('user_position_update', message => this.cache.update(message.payload.data, message.payload.selector))
        this.ipc.on('user_position_create', message => this.cache.push(this.getRow(message.payload)))

    }
    
    /**
     * @param { { [s: string]: any } } filter
     * @param { Boolean } invert 
     * @returns { Promise<ScrimsUserPosition[]> }
     */
    async get(filter, invert) {

        return super.get(filter, invert);

    }

    /** 
     * @param { { [s: string]: any } } data
     * @returns { Promise<ScrimsUserPosition> }
     */
    async create(data) {

        return super.create(data);

    }

    /** 
     * @param { { [s: string]: any } } selector
     * @returns { Promise<ScrimsUserPosition[]> }
     */
    async remove(selector) {

        return super.remove(selector);

    }

}

class ScrimsPositionRolesCache extends DBCache {

    /** 
     * @param { { [s: string]: any } } filter
     * @param { Boolean } invert
     * @returns { ScrimsPositionRole[] }
     */
    get(filter, invert) {

        return super.get(filter, invert);

    }

}

class ScrimsPositionRolesTable extends DBTable {

    constructor(client) {

        const foreigners = [
            [ "position", "id_position", "get_position_id" ]
        ]

        super(client, "scrims_position_role", "get_position_roles", foreigners, {}, ScrimsPositionRole);

        /**
         * @type { ScrimsPositionRolesCache }
         */
        this.cache

    }

    /**
     * @override
     */
    initializeListeners() {

        this.ipc.on('position_role_remove', message => this.cache.remove(message.payload))
        this.ipc.on('position_role_update', message => this.cache.update(message.payload.data, message.payload.selector))
        this.ipc.on('position_role_create', message => this.cache.push(this.getRow(message.payload)))

    }
    
    /** 
     * @param { { [s: string]: any } } filter
     * @param { Boolean } invert
     * @returns { Promise<ScrimsPositionRole[]> }
     */
    async get(filter, invert) {

        return super.get(filter, invert);

    }

    /** 
     * @param { { [s: string]: any } } data
     * @returns { Promise<ScrimsPositionRole> }
     */
    async create(data) {

        return super.create(data);

    }

    /** 
     * @param { { [s: string]: any } } selector
     * @returns { Promise<ScrimsPositionRole[]> }
     */
    async remove(selector) {

        return super.remove(selector);

    }

}

class ScrimsGuildEntryTypeTable extends DBTable {

    constructor(client) {

        super(client, "scrims_guild_entry_type", null, [], { defaultTTL: -1, maxKeys: -1 });
        
    }

}

class ScrimsGuildEntrysCache extends DBCache {

    /** 
     * @param { { [s: string]: any } } filter
     * @param { Boolean } invert
     * @returns { ScrimsGuildEntry[] }
     */
    get(filter, invert) {

        return super.get(filter, invert);

    }

}

class ScrimsGuildEntrysTable extends DBTable {

    constructor(client) {

        const foreigners = [
            [ "type", "id_type", "get_guild_entry_type_id" ]
        ]

        super(client, "scrims_guild_entry", "get_guild_entrys", foreigners, { defaultTTL: -1, maxKeys: -1 }, ScrimsGuildEntry);

        /**
         * @type { ScrimsGuildEntrysCache }
         */
        this.cache

    }

    /**
     * @override
     */
    initializeListeners() {

        this.ipc.on('guild_entry_remove', message => this.cache.remove(message.payload))
        this.ipc.on('guild_entry_update', message => this.cache.update(message.payload.data, message.payload.selector))
        this.ipc.on('guild_entry_create', message => this.cache.push(this.getRow(message.payload)))

    }
    
    /**
     * @param { { [s: string]: any } } filter
     * @param { Boolean } invert 
     * @returns { Promise<ScrimsGuildEntry[]> }
     */
     async get(filter, invert) {

        return super.get(filter, invert);

    }

    /** 
     * @param { { [s: string]: any } } data
     * @returns { Promise<ScrimsGuildEntry> }
     */
    async create(data) {

        return super.create(data);

    }

    /**
     * @param { { [s: string]: any } } selector
     * @returns { Promise<ScrimsGuildEntry[]> }
     */
    async remove(selector) {

        return super.remove(selector);

    }

}

module.exports = {

    ScrimsGuildTable,
    ScrimsUserTable,
    ScrimsPositionTable,
    ScrimsUserPositionsTable,
    ScrimsPositionRolesTable,
    ScrimsGuildEntryTypeTable,
    ScrimsGuildEntrysTable
    
};