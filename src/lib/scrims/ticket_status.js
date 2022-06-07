const TableRow = require("../postgresql/row");

class ScrimsTicketStatus extends TableRow {

    static uniqueKeys = ['id_status']
    static columns = ['id_status', 'name']

    constructor(client, statusData) {

        super(client, statusData);

        /** @type {number} */
        this.id_status

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

module.exports = ScrimsTicketStatus;