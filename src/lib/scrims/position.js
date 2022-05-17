const TableRow = require("../postgresql/row");
const DBTable = require("../postgresql/table");

/**
 * @extends DBTable<ScrimsPosition>
 */
class ScrimsPositionTable extends DBTable {

    constructor(client) {

        super(client, "scrims_position", "get_positions", [], ['id_position'], ScrimsPosition);
        
    }

}

class ScrimsPosition extends TableRow {

    /**
     * @type { ScrimsPositionTable }
     */
    static Table = ScrimsPositionTable

    static ranks = ['prime', 'private', 'premium']

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

    isRank() {

        return ScrimsPosition.ranks.includes(this.name);

    }

    get capitalizedName() {

        return this.name && this.name[0].toUpperCase() + this.name.slice(1);

    }

}

module.exports = ScrimsPosition;