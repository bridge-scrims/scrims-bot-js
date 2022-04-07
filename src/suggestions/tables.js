const DBTable = require("../lib/postgresql/table");

class SuggestionsTable extends DBTable {


    constructor(client) {

        const foreigners = [
            [ "creator", "id_creator", "get_user_id" ]
        ]

        super(client, "scrims_suggestion", "get_suggestions", foreigners);

    }

    // @Overrides
    initializeListeners() {

        this.ipc.on('suggestion_remove', message => this.cache.remove(message.payload))
        this.ipc.on('suggestion_update', message => this.cache.update(message.payload.data, message.payload.selector))
        this.ipc.on('suggestion_create', message => this.cache.push(message.payload))

    }
    

}

module.exports = { SuggestionsTable };