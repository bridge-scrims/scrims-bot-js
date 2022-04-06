
const Pool = require('pg-pool');
const pgIPC = require('pg-ipc');

const DBTable = require("./table.js");
const DBCache = require('./cache.js');

class DBClient {

    constructor(config) {

        this.pool = new Pool({

            user: config.username,
            password: config.password,
            host: config.hostname,
            port: config.port,
            database: config.database

        })

        this.pool.on('error', error => console.error(`Unexpected pgsql pool error ${error}!`))

        this.tables = []

        this.addTable("users", new UserTable(this))

        this.addTable("positions", new PositionTable(this))
        this.addTable("userPositions", new UserPositionsTable(this))
        this.addTable("positionRoles", new PositionRolesTable(this))

        this.addTable("guildEntryTypes", new DBTable(this, "scrims_guild_entry_type"))
        this.addTable("guildEntrys", new GuildEntrysTable(this))

    }

    addTable(key, table) {

        this.tables.push(table)
        this[key] = table

    }

    async connect() {

        this.ipcClient = await this.pool.connect()
        this.ipcClient.on('error', error => console.error(`Unexpected pgsql ipc client error ${error}!`))
        
        this.ipc = pgIPC(this.ipcClient)
        this.ipc.on('end', () => this.ipcClient?.end())

        await this.initializeCache()

    }

    async destroy() {

        try {

            await this.ipc.end()
            await this.pool.end()       

        }catch(error) {
            
            console.warn(`Unable to destroy database client!`, error)

        }

    }
 
    async initializeCache() {

        await Promise.all(this.tables.map(table => table.connect()))
        this.tables = []

    }
    
    async query(...args) {

        return this.pool.query(...args);
        
    }
  
}

class GuildEntrysTable extends DBTable {


    constructor(client) {

        super(client, "scrims_guild_entry", "get_guild_entrys", [ "type", "id_type", "get_guild_entry_type_id" ]);

    }


    // @Overrides
    initializeListeners() {

        this.ipc.on('guild_entry_remove', message => this.cache.remove(message.payload))
        this.ipc.on('guild_entry_update', message => this.cache.update(message.payload.data, message.payload.selector))
        this.ipc.on('guild_entry_create', message => this.cache.push(message.payload))

    }
    

}


class UserTable extends DBTable {


    constructor(client) {

        super(client, "scrims_user", "get_users");

    }


    // @Overrites
    initializeListener() {

        this.ipc.on('scrims_user_remove', message => this.cache.remove(message.payload))
        this.ipc.on('scrims_user_update', message => this.cache.update(message.payload.data, message.payload.selector))
        this.ipc.on('scrims_user_create', message => this.cache.push(message.payload))

    }


}


class PositionTable extends DBTable {


    constructor(client) {

        super(client, "scrims_position", "get_positions");

    }


    // @Overrites
    initializeListeners() {

        this.ipc.on('user_position_update', message => this._onPositionInstance(message.payload.data.position))
        this.ipc.on('user_position_create', message => this._onPositionInstance(message.payload.position))

    }

    _onPositionInstance(position) {

        const updated = this.cache.update(position, { id_position: position.id_position })
        if (!updated) this.cache.push(position)

    }


}


class UserPositionCache extends DBCache {


    // @Overrides
    get( ...args ) {

        // Get them expired boys out of here
        const expired = this.getEntrys().filter(([ _, userPos ]) => userPos.expires_at !== null && userPos.expires_at <= (Date.now()/1000))
        
        expired.forEach(([ _, value ]) => this.emit('remove', value))
        expired.forEach(([ key, _ ]) => this.del(key))

        return super.get( ...args )

    }


}


class UserPositionsTable extends DBTable {


    constructor(client) {

        const foreigners = [
            [ "executor", "id_executor", "get_user_id" ], 
            [ "user", "id_user", "get_user_id" ], 
            [ "position", "id_position", "get_position_id" ] 
        ]

        super(client, "scrims_user_position", "get_user_positions", foreigners);
        this.cache = new UserPositionCache()

    }


    // @Overrides
    initializeListeners() {

        this.ipc.on('user_position_remove', message => this.cache.remove(message.payload))
        this.ipc.on('user_position_update', message => this.cache.update(message.payload.data, message.payload.selector))
        this.ipc.on('user_position_create', message => this.cache.push(message.payload))

    }
    

}


class PositionRolesTable extends DBTable {


    constructor(client) {

        const foreigners = [
            [ "position", "id_position", "get_position_id" ]
        ]

        super(client, "scrims_position_role", "get_position_roles", foreigners);

    }


    // @Overrites
    initializeListeners() {

        this.ipc.on('position_role_remove', message => this.cache.remove(message.payload))
        this.ipc.on('position_role_update', message => this.cache.update(message.payload.data, message.payload.selector))
        this.ipc.on('position_role_create', message => this.cache.push(message.payload))

    }
    

}



module.exports = DBClient;