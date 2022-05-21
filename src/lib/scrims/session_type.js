const DBTable = require("../postgresql/table");
const TableRow = require("../postgresql/row");

/**
 * @extends DBTable<ScrimsSessionType>
 */
class ScrimsSessionTypeTable extends DBTable {

    constructor(client) {

        const foreigners = []
        const uniqueKeys = ['id_type']

        super(client, "scrims_session_type", null, foreigners, uniqueKeys, ScrimsSessionType);

    }
    
}

class ScrimsSessionType extends TableRow {

    /**
     * @type { ScrimsSessionTypeTable }
     */
    static Table = ScrimsSessionTypeTable

    constructor(table, sessionData) {

        super(table, sessionData, [])

        /**
         * @type { number } 
         */
        this.id_type

        /**
         * @type { string }
         */
        this.name

    }

}

module.exports = ScrimsSessionType;