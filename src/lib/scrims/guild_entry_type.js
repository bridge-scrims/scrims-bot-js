const TableRow = require("../postgresql/row");

class ScrimsGuildEntryType extends TableRow {

    static uniqueKeys = ['id_type']
    static columns = ['id_type', 'name']

    constructor(client, typeData) {

        super(client, typeData);

        /** @type {number} */
        this.id_type

        /** @type {string} */
        this.name

    }

    /**
     * @param {string} name 
     */
    setName(name) {
        
        this.name = name
        return this;

    }

    get capitalizedName() {

        return this.name && this.name[0].toUpperCase() + this.name.slice(1);

    }

}

module.exports = ScrimsGuildEntryType;