
const Pool = require('pg-pool');
const pgIPC = require('pg-ipc');

const DBTable = require("./table.js");

class DBClient {

    constructor(config) {

        this.pool = new Pool({

            user: config.username,
            password: config.password,
            host: config.hostname,
            port: config.port,
            database: config.database

        })

        this.users = new UserTable(this)
        this.positions = new PositionTable(this)
        this.userPositions = new UserPositionsTable(this)
        this.positionRoles = new PositionRolesTable(this)

    }

    async connect() {

        this.ipcClient = await this.pool.connect()
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

        await this.users.connect()
        await this.positions.connect()
        await this.userPositions.connect()
        await this.positionRoles.connect()

    }
    
    async query(...args) {

        return this.pool.query(...args);
        
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
    initializeListener() {

        this.ipc.on('user_position_update', message => this._onPositionInstance(message.payload.data.position))
        this.ipc.on('user_position_create', message => this._onPositionInstance(message.payload.position))

    }

    _onPositionInstance(position) {

        const updated = this.cache.update(position, { id_position: position.id_position })
        if (!updated) this.cache.push(position)

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

    }


    // @Overrites
    initializeListener() {

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
    initializeListener() {

        this.ipc.on('position_role_remove', message => this.cache.remove(message.payload))
        this.ipc.on('position_role_update', message => this.cache.update(message.payload.data, message.payload.selector))
        this.ipc.on('position_role_create', message => this.cache.push(message.payload))

    }
    

}



module.exports = DBClient;