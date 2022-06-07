const DBCache = require("../postgresql/cache");
const DBTable = require("../postgresql/table");

const ScrimsUserPosition = require("./user_position");

/**
 * @extends DBCache<ScrimsUserPosition>
 */
class ScrimsUserPositionCache extends DBCache {

    /**
     * @override
     * @param {string} id
     * @param {ScrimsUserPosition} value 
     */
    set(id, value) {

        if (value?.position?.name !== "bridge_scrims_member") this.data[id] = value

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
        super(client, "scrims_user_position", "get_user_positions", {}, foreigners, ScrimsUserPosition);
        
        /**
         * @type { ScrimsUserPositionCache }
         */
        this.cache = new ScrimsUserPositionCache()

    }

}

module.exports = ScrimsUserPositionsTable;