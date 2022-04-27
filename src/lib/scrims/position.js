const DBCache = require("../postgresql/cache");
const DBTable = require("../postgresql/table");

class ScrimsPositionCache extends DBCache {

    /** 
     * @param { Object.<string, any> } filter
     * @param { Boolean } invert
     * @returns { ScrimsPosition[] }
     */
    get(filter, invert) {

        return super.get(filter, invert);

    }

}

class ScrimsPositionTable extends DBTable {

    constructor(client) {

        super(client, "scrims_position", "get_positions", [], ScrimsPosition, ScrimsPositionCache);

        /**
         * @type { ScrimsPositionCache }
         */
        this.cache
        
    }

    /** 
     * @param { Object.<string, any> } filter
     * @param { Boolean } useCache
     * @returns { Promise<ScrimsPosition[]> }
     */
    async get(filter, useCache) {

        return super.get(filter, useCache);

    }

    /** 
     * @param { Object.<string, any> } data
     * @returns { Promise<ScrimsPosition> }
     */
    async create(data) {

        return super.create(data);

    }

    /** 
     * @param { Object.<string, any> } selector
     * @returns { Promise<ScrimsPosition[]> }
     */
    async remove(selector) {

        return super.remove(selector);

    }

}

class ScrimsPosition extends DBTable.Row {

    /**
     * @type { ScrimsPositionTable }
     */
    static Table = ScrimsPositionTable

    constructor(client, positionData) {

        super(client, positionData, []);

        /**
         * @type { number }
         */
        this.id_position

        /**
         * @type { string }
         */
        this.name

         /**
         * @type { boolean }
         */
        this.sticky

        /**
         * @type { number }
         */
        this.level

    }

}

module.exports = ScrimsPosition;