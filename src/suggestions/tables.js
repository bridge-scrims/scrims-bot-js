const DBTable = require("../lib/postgresql/table");

class SuggestionsTable extends DBTable {


    constructor(client) {

        const foreigners = [
            [ "creator", "id_creator", "get_user_id" ]
        ]

        super(client, "scrims_suggestion", "get_suggestions", foreigners);

    }
    

}

module.exports = { SuggestionsTable };