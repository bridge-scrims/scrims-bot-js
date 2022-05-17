const DBCache = require("../postgresql/cache");
const DBTable = require("../postgresql/table");
const TableRow = require("../postgresql/row");
const ScrimsPosition = require("./position");
const ScrimsUser = require("./user");

/**
 * @extends DBCache<ScrimsUserPosition>
 */
class ScrimsUserPositionCache extends DBCache {

    /**
     * @override
     * @param { string[] } ids
     * @returns { ScrimsUserPosition }
     */
    get( ...ids ) {

        const expired = this.values().filter(userPos => userPos.expires_at !== null && userPos.expires_at <= (Date.now()/1000))
        
        expired.forEach(value => this.remove(value.id))
        expired.forEach(value => this.emit('remove', value))

        return super.get(...ids);

    }

}

/**
 * @extends DBTable<ScrimsUserPosition>
 */
class ScrimsUserPositionsTable extends DBTable {

    constructor(client) {

        const foreigners = [
            [ "executor", "id_executor", "get_user_id" ], 
            [ "user", "id_user", "get_user_id" ], 
            [ "position", "id_position", "get_position_id" ] 
        ]

        const uniqueKeys = [ 'id_user', 'id_position' ]

        super(client, "scrims_user_position", "get_user_positions", foreigners, uniqueKeys, ScrimsUserPosition, ScrimsUserPositionCache);
        
        /**
         * @type { ScrimsUserPositionCache }
         */
        this.cache

    }

    /**
     * @override
     */
    initializeListeners() {

        this.ipc.on('user_position_remove', message => this.cache.filterOut(message.payload))
        this.ipc.on('user_position_update', message => this.cache.update(message.payload.data, message.payload.selector))
        this.ipc.on('user_position_create', message => this.cache.push(this.getRow(message.payload)))

    }

    /** 
     * @param { Object.<string, any> } data
     * @returns { Promise<ScrimsUserPosition> }
     */
    async create(data) {

        const obj = this.getRow(data)

        if (obj?.position?.name === "bridge_scrims_member") {

            const [ formated, formatValues ] = this.format(obj.toMinimalForm())
            await this.query( ...this.createInsertQuery(formated, formatValues) )
            return obj;

        }

        return super.create(obj);

    }

}

class ScrimsUserPosition extends TableRow {

    /**
     * @type { ScrimsUserPositionsTable }
     */
    static Table = ScrimsUserPositionsTable

    constructor(table, userPositionData) {

        const references = [
            ['user', ['id_user'], ['id_user'], table.client.users],
            ['position', ['id_position'], ['id_position'], table.client.positions],
            ['executor', ['id_executor'], ['id_user'], table.client.users]
        ]

        super(table, userPositionData, references)

        /**
         * @type { string }
         */
        this.id_user
        
        /**
         * @type { ScrimsUser }
         */
        this.user

        /**
         * @type { number }
         */
        this.id_position

        /**
         * @type { ScrimsPosition }
         */
        this.position
        
        /**
         * @type { string }
         */
        this.id_executor

        /**
         * @type { ScrimsUser }
         */
        this.executor

        /**
         * @type { number }
         */
        this.given_at

        /**
         * @type { number }
         */
        this.expires_at

    }

    isExpired() {

        return (this.expires_at !== null && this.expires_at <= (Date.now()/1000));

    }

    getDuration() {

        return (this.expires_at === null) ? `\`permanently\`` 
            : ((!this.expires_at) ? '\`for an unknown time period\`' : `until <t:${this.expires_at}:F>`);

    }

}

module.exports = ScrimsUserPosition;