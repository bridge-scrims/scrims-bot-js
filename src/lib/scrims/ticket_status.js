const DBCache = require("../postgresql/cache");
const TableRow = require("../postgresql/row");
const DBTable = require("../postgresql/table");

class ScrimsTicketStatusCache extends DBCache {


}

class ScrimsTicketStatusTable extends DBTable {

    constructor(client) {

        super(client, "scrims_ticket_status", null, [], ['id_status'], ScrimsTicketStatus, ScrimsTicketStatusCache);

        /**
         * @type { ScrimsTicketStatusCache }
         */
        this.cache

    }

    /** 
     * @param { Object.<string, any> } filter
     * @param { Boolean } useCache
     * @returns { Promise<ScrimsTicketStatus[]> }
     */
    async get(filter, useCache) {

        return super.get(filter, useCache);

    }

    /** 
     * @param { Object.<string, any> } data
     * @returns { Promise<ScrimsTicketStatus> }
     */
    async create(data) {

        return super.create(data);

    }

    /**
     * @param { Object.<string, any> } selector
     * @returns { Promise<ScrimsTicketStatus[]> }
     */
    async remove(selector) {

        return super.remove(selector);

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