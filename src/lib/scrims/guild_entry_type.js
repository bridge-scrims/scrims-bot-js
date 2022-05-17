const TableRow = require("../postgresql/row");
const DBTable = require("../postgresql/table");

/**
 * @extends DBTable<ScrimsGuildEntryType>
 */
class ScrimsGuildEntryTypeTable extends DBTable {

    constructor(client) {

        super(client, "scrims_guild_entry_type", null, [], ['id_type'], ScrimsGuildEntryType);

    }

}

class ScrimsGuildEntryType extends TableRow {

    /**
     * @type { ScrimsGuildEntryTypeTable }
     */
    static Table = ScrimsGuildEntryTypeTable
    
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

module.exports = ScrimsGuildEntryType;