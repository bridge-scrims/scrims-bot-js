const DBCache = require("../postgresql/cache");
const TableRow = require("../postgresql/row");
const DBTable = require("../postgresql/table");

class ScrimsGuildEntryTypeCache extends DBCache {


}

class ScrimsGuildEntryTypeTable extends DBTable {

    constructor(client) {

        super(client, "scrims_guild_entry_type", null, [], ['id_type'], ScrimsGuildEntryType, ScrimsGuildEntryTypeCache);
        
        /**
         * @type { ScrimsGuildEntryTypeCache }
         */
        this.cache

    }

    /** 
     * @param { Object.<string, any> } filter
     * @param { Boolean } useCache
     * @returns { Promise<ScrimsGuildEntryType[]> }
     */
    async get(filter, useCache) {

        return super.get(filter, useCache);

    }

    /** 
     * @param { Object.<string, any> } data
     * @returns { Promise<ScrimsGuildEntryType> }
     */
    async create(data) {

        return super.create(data);

    }

    /** 
     * @param { Object.<string, any> } selector
     * @returns { Promise<ScrimsGuildEntryType[]> }
     */
    async remove(selector) {

        return super.remove(selector);

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