const Pool = require('pg-pool');
const pgIPC = require('pg-ipc');

const {

    ScrimsGuildTable,
    ScrimsUserTable,
    ScrimsPositionTable,
    ScrimsUserPositionsTable,
    ScrimsPositionRolesTable,
    ScrimsGuildEntryTypeTable,
    ScrimsGuildEntrysTable
    
} = require('../scrims/tables');

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
        this.__addScrimsTables()
        
        /**
         * @type { ScrimsGuildTable }
         */
        this.guilds

        /**
         * @type { ScrimsUserTable }
         */
        this.users

        /**
         * @type { ScrimsPositionTable }
         */
        this.positions

        /**
         * @type { ScrimsUserPositionsTable }
         */
        this.userPositions

        /**
         * @type { ScrimsPositionRolesTable }
         */
        this.positionRoles
 
        /**
         * @type { ScrimsGuildEntryTypeTable }
         */
        this.guildEntryTypes

        /**
         * @type { ScrimsGuildEntrysTable }
         */
        this.guildEntrys

    }

    __addScrimsTables() {

        this.addTable("guilds", new ScrimsGuildTable(this))
        this.addTable("users", new ScrimsUserTable(this))

        this.addTable("positions", new ScrimsPositionTable(this))
        this.addTable("userPositions", new ScrimsUserPositionsTable(this))
        
        this.addTable("positionRoles", new ScrimsPositionRolesTable(this))

        this.addTable("guildEntryTypes", new ScrimsGuildEntryTypeTable(this))
        this.addTable("guildEntrys", new ScrimsGuildEntrysTable(this))

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

module.exports = DBClient;