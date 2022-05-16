const DBCache = require("../postgresql/cache");
const DBTable = require("../postgresql/table");
const TableRow = require("../postgresql/row");

const ScrimsSessionType = require("./session_type");
const ScrimsUser = require("./user");

/**
 * @class
 * @extends DBTable<ScrimsSession>
 */
class ScrimsSessionTable extends DBTable {

    constructor(client) {

        const foreigners = [
            [ "type", "id_type", "get_session_type_id" ],
            [ "creator", "id_creator", "get_user_id" ]
        ]

        const uniqueKeys = ['id_session']

        super(client, "scrims_session", "get_sessions", foreigners, uniqueKeys, ScrimsSession);

        /**
         * @type { DBCache<ScrimsSession> }
         */
        this.cache

    }
    
}

class ScrimsSession extends TableRow {

    /**
     * @type { ScrimsSessionTable }
     */
    static Table = ScrimsSessionTable

    constructor(table, sessionData) {

        const references = [
            ['type', ['id_type'], ['id_type'], table.client.sessionTypes],
            ['creator', ['id_creator'], ['id_user'], table.client.users]
        ]

        super(table, sessionData, references)

        /**
         * @type { string } 
         */
        this.id_session

        /**
         * @type { number }
         */
        this.id_type

        /**
         * @type { ScrimsSessionType } 
         */
        this.type

        /**
         * @type { string }
         */
        this.id_creator

        /**
         * @type { ScrimsUser }
         */
        this.creator

        /**
         * @type { number }
         */
        this.started_at

    }

}

module.exports = ScrimsSession;