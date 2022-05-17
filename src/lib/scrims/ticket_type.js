const TableRow = require("../postgresql/row");
const DBTable = require("../postgresql/table");

/**
 * @extends DBTable<ScrimsTicketType>
 */
class ScrimsTicketTypeTable extends DBTable {

    constructor(client) {

        super(client, "scrims_ticket_type", null, [], ['id_type'], ScrimsTicketType);

    }

}

class ScrimsTicketType extends TableRow {

    /**
     * @type { ScrimsTicketTypeTable }
     */
    static Table = ScrimsTicketTypeTable
    
    constructor(client, typeData) {

        super(client, typeData, []);

        /**
         * @type { number }
         */
        this.id_type

        /**
         * @type { string }
         */
        this.name

    }

    get capitalizedName() {

        return this.name && this.name[0].toUpperCase() + this.name.slice(1);

    }

}

module.exports = ScrimsTicketType;