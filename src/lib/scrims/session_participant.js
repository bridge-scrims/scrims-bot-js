const DBTable = require("../postgresql/table");
const TableRow = require("../postgresql/row");

const ScrimsSession = require("./session");
const ScrimsUser = require("./user");

/**
 * @extends DBTable<ScrimsSessionParticipant>
 */
class ScrimsSessionParticipantTable extends DBTable {

    constructor(client) {

        const foreigners = [
            [ "session", "id_session", "get_session_id" ],
            [ "user", "id_user", "get_user_id" ]
        ]

        const uniqueKeys = ['id_session', 'id_user']

        super(client, "scrims_session_participant", "get_session_participants", foreigners, uniqueKeys, ScrimsSessionParticipant);

    }
    
}

class ScrimsSessionParticipant extends TableRow {

    /**
     * @type { ScrimsSessionParticipantTable }
     */
    static Table = ScrimsSessionParticipantTable

    constructor(table, participantData) {

        const references = [
            ['session', ['id_session'], ['id_session'], table.client.sessions],
            ['user', ['id_user'], ['id_user'], table.client.users]
        ]

        super(table, participantData, references)

        /**
         * @type { string } 
         */
        this.id_session

        /**
         * @type { ScrimsSession }
         */
        this.session

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
        this.joined_at

        /**
         * @type { number }
         */
        this.participation_time

    }

}

module.exports = ScrimsSessionParticipant;