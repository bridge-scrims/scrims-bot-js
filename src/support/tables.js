const DBTable = require("../lib/postgresql/table");

class TicketMessagesTable extends DBTable {


    constructor(client) {

        const foreigners = [
            [ "ticket", "id_ticket", "get_ticket_id" ],
            [ "author", "id_author", "get_user_id" ]
        ]

        super(client, "scrims_ticket_message", "get_ticket_messages", foreigners);

    }
    

}

class TicketTypeTable extends DBTable {


    constructor(client) {

        super(client, "scrims_ticket_type");

    }


}

class TicketTable extends DBTable {


    constructor(client) {

        const foreigners = [
            [ "user", "id_user", "get_user_id" ],
            [ "type", "id_type", "get_ticket_type_id" ]
        ]

        super(client, "scrims_ticket", "get_tickets", foreigners);

    }
    

}

module.exports = { TicketMessagesTable, TicketTypeTable, TicketTable };