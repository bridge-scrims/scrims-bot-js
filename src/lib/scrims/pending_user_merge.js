const TableRow = require("../postgresql/row");
const ScrimsUser = require("./user");

class PendingUserMerge extends TableRow {

    static uniqueKeys = ['mc_uuid']
    static columns = ['', 'code', 'expiration']


    constructor(client, data) {
        

        super(client, data);

        /** @type { string } */
        this.id_to_link

        /** @type { ScrimsUser } */
        this.to_link

        /** @type { number } */
        this.code

        /** @type { number } */
        this.expiration
    }

}

module.exports = PendingUserMerge;