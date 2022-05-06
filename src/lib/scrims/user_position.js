const DBCache = require("../postgresql/cache");
const DBTable = require("../postgresql/table");
const ScrimsPosition = require("./position");
const ScrimsUser = require("./user");

class ScrimsUserPositionCache extends DBCache {

    /**
     * @override
     * @param { Object.<string, any> } filter
     * @param { Boolean } invert
     * @returns { ScrimsUserPosition[] }
     */
    get(filter, invert) {

        const expired = this.data.filter(userPos => userPos.expires_at !== null && userPos.expires_at <= (Date.now()/1000))
        
        this.data = this.data.filter(value => !expired.includes(value))
        expired.forEach(value => this.emit('remove', value))

        return super.get(filter, invert);

    }

    /**
     * @param { ScrimsUserPosition[] } userPosition 
     */
    set(userPositions) {

        const data = this.getArrayMap('id_user')
        return userPositions.map(userPos => this.push(userPos, (data[userPos.id_user] ?? []).filter(v => v.id_position === userPos.id_position)[0] ?? false, false));

    }

}

class ScrimsUserPositionsTable extends DBTable {

    constructor(client) {

        const foreigners = [
            [ "executor", "id_executor", "get_user_id" ], 
            [ "user", "id_user", "get_user_id" ], 
            [ "position", "id_position", "get_position_id" ] 
        ]

        super(client, "scrims_user_position", "get_user_positions", foreigners, ScrimsUserPosition, ScrimsUserPositionCache);
        
        /**
         * @type { ScrimsUserPositionCache }
         */
        this.cache

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
     * @param { Object.<string, any>[] } userPositionDatas 
     * @returns { ScrimsUserPosition[] }
     */
    getRows(userPositionDatas) {

        const scrimsUsers = this.client.users.cache.getMap("id_user")
        const scrimsPositions = this.client.positions.cache.getMap("id_position")

        userPositionDatas.forEach(userPositionData => {

            userPositionData.user = scrimsUsers[userPositionData.id_user] ?? null
            userPositionData.position = scrimsPositions[userPositionData.id_position] ?? null
            userPositionData.executor = scrimsUsers[userPositionData.id_executor] ?? null

        })

        return super.getRows(userPositionDatas);

    }
    
    /** 
     * @param { Object.<string, any> } filter
     * @param { Boolean } useCache
     * @returns { Promise<ScrimsUserPosition[]> }
     */
    async get(filter, useCache) {

        return super.get(filter, useCache);

    }

    /** 
     * @param { Object.<string, any> } data
     * @returns { Promise<ScrimsUserPosition> }
     */
    async create(data) {

        if (data?.position?.name === "bridge_scrims_member") {

            const [ formated, formatValues ] = this.format({ ...data })
            return this.query( ...this.createInsertQuery(formated, formatValues) );

        }

        return super.create(data);

    }

    /** 
     * @param { Object.<string, any> } selector
     * @returns { Promise<ScrimsUserPosition[]> }
     */
    async remove(selector) {

        return super.remove(selector);

    }

}

class ScrimsUserPosition extends DBTable.Row {

    /**
     * @type { ScrimsUserPositionsTable }
     */
    static Table = ScrimsUserPositionsTable

    constructor(client, userPositionData) {

        const references = [
            ['user', ['id_user'], ['id_user'], client.users],
            ['position', ['id_position'], ['id_position'], client.positions],
            ['executor', ['id_executor'], ['id_user'], client.users]
        ]

        super(client, userPositionData, references)

        /**
         * @type { number }
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
         * @type { number }
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

    /**
     * @override
     * @param { Object.<string, any> } obj 
     * @returns { Boolean }
     */
    equals(obj) {

        if (obj instanceof ScrimsUserPosition) {

            return (obj.id_user === this.id_user && obj.id_position === this.id_position);

        }
        
        return this.valuesMatch(obj, this);

    }

}

module.exports = ScrimsUserPosition;