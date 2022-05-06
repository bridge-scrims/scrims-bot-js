const DBCache = require("../postgresql/cache");
const DBTable = require("../postgresql/table");

class ScrimsTicketTypeCache extends DBCache {

}

class ScrimsTicketTypeTable extends DBTable {

    constructor(client) {

        super(client, "scrims_ticket_type", null, [], ScrimsTicketType, ScrimsTicketTypeCache);

        /**
         * @type { ScrimsTicketTypeCache }
         */
        this.cache

    }

    /** 
     * @param { Object.<string, any> } filter
     * @param { Boolean } useCache
     * @returns { Promise<ScrimsTicketType[]> }
     */
    async get(filter, useCache) {

        return super.get(filter, useCache);

    }

    /** 
     * @param { Object.<string, any> } data
     * @returns { Promise<ScrimsTicketType> }
     */
    async create(data) {

        return super.create(data);

    }

    /**
     * @param { Object.<string, any> } selector
     * @returns { Promise<ScrimsTicketType[]> }
     */
    async remove(selector) {

        return super.remove(selector);

    }

}

class ScrimsTicketType extends DBTable.Row {

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