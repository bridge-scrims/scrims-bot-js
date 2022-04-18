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
     * @param { ScrimsUserPosition } userPosition 
     * @returns { ScrimsUserPosition }
     */
    push(userPosition) {

        if (userPosition?.position?.name === "bridge_scrims_member") return userPosition;
        return super.push(userPosition)

    }

    /**
     * @param { ScrimsUserPosition[] } userPosition 
     */
    set(userPositions) {

        userPositions = userPositions.filter(userPosition => userPosition?.position?.name !== "bridge_scrims_member")
        return super.set(userPositions)

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

        super(client, {})

        /**
         * @type { Integer }
         */
        this.id_user = userPositionData.id_user;
        
        /**
         * @type { ScrimsUser }
         */
        this.user
        this.setScrimsUser(userPositionData.user)

        /**
         * @type { Integer }
         */
        this.id_position = userPositionData.id_position;

        /**
         * @type { ScrimsPosition }
         */
        this.position
        this.setPosition(userPositionData.position)
        

        /**
         * @type { Integer }
         */
        this.id_executor = userPositionData.id_executor;

        /**
         * @type { ScrimsUser }
         */
        this.executor
        this.setExecutorUser(userPositionData.executor)
        

        /**
         * @type { Integer }
         */
        this.given_at = userPositionData.given_at;


        /**
         * @type { Integer }
         */
        this.expires_at = userPositionData.expires_at;

    }

    setScrimsUser(obj) {

        if (obj === null) this.user = null

        this.user = (obj instanceof ScrimsUser) ? obj : this.client.users.cache.get({ id_user: this.id_user })[0]

    }

    setPosition(obj) {

        if (obj === null) this.position = null

        this.position = (obj instanceof ScrimsPosition) ? obj : this.client.positions.cache.get({ id_position: this.id_position })[0]

    }

    setExecutorUser(obj) {

        if (obj === null) this.executor = null

        this.executor = (obj instanceof ScrimsUser) ? obj : this.client.users.cache.get({ id_user: this.id_executor })[0]

    }

    /**
     * @override 
     */
    updateWith(data) {

        if (data.id_user && (data.id_user != this.id_user)) {

            this.id_user = data.id_user
            this.setScrimsUser(data.user)

        }

        if (data.id_position && (data.id_position != this.id_position)) {

            this.id_position = data.id_position
            this.setPosition(data.position)

        }

        if (data.id_executor && ( data.id_executor != this.id_executor)) {

            this.id_executor = data.id_executor
            this.setExecutorUser(data.executor)

        }

        if (data.given_at) this.given_at = data.given_at;

        if (data.expires_at) this.expires_at = data.expires_at;

        return this;
        
    }

    getDuration() {

        return (this.expires_at === null) ? `\`permanently\`` 
            : ((!this.expires_at) ? '\`for an unknown time period\`' : `until <t:${this.expires_at}:F>`);

    }

}

module.exports = ScrimsUserPosition;