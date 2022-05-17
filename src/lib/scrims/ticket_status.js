const TableRow = require("../postgresql/row");
const DBTable = require("../postgresql/table");

/**
 * @extends DBTable<ScrimsTicketStatus>
 */
class ScrimsTicketStatusTable extends DBTable {

    constructor(client) {

        super(client, "scrims_ticket_status", null, [], ['id_status'], ScrimsTicketStatus);

    }

}

class ScrimsTicketStatus extends TableRow {

    /**
     * @type { ScrimsTicketStatusTable }
     */
    static Table = ScrimsTicketStatusTable
    
    constructor(client, statusData) {

        super(client, statusData, []);

        /**
         * @type { number }
         */
        this.id_status

        /**
         * @type { string }
         */
        this.name

    }

    get capitalizedName() {

        return this.name && this.name[0].toUpperCase() + this.name.slice(1);

    }
    
}

module.exports = ScrimsTicketStatus;