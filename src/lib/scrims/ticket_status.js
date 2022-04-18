const DBCache = require("../postgresql/cache");
const DBTable = require("../postgresql/table");

class ScrimsTicketStatusCache extends DBCache {

    /** 
     * @param { Object.<string, any> } filter
     * @param { Boolean } invert
     * @returns { ScrimsTicketStatus[] }
     */
    get(filter, invert) {

        return super.get(filter, invert);

    }

}

class ScrimsTicketStatusTable extends DBTable {

    constructor(client) {

        super(client, "scrims_ticket_status", null, [], ScrimsTicketStatus, ScrimsTicketStatusCache);

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

class ScrimsTicketStatus extends DBTable.Row {

    /**
     * @type { ScrimsTicketStatusTable }
     */
    static Table = ScrimsTicketStatusTable
    
    constructor(client, statusData) {

        super(client, {});

        /**
         * @type { Integer }
         */
        this.id_status = statusData.id_status

        /**
         * @type { String }
         */
        this.name = statusData.name

    }

}

module.exports = ScrimsTicketStatus;