const DBCache = require("../postgresql/cache");
const DBTable = require("../postgresql/table");

class ScrimsTicketTypeCache extends DBCache {

    /** 
     * @param { Object.<string, any> } filter
     * @param { Boolean } invert
     * @returns { ScrimsTicketType[] }
     */
    get(filter, invert) {

        return super.get(filter, invert);

    }

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

        super(client, {});

        /**
         * @type { Integer }
         */
        this.id_type = typeData.id_type

        /**
         * @type { String }
         */
        this.name = typeData.name

    }

    get capitalizedName() {

        return this.name && this.name[0].toUpperCase() + this.name.slice(1);

    }

}

module.exports = ScrimsTicketType;