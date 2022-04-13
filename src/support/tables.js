const DBTable = require("../lib/postgresql/table");

class TicketMessagesTable extends DBTable {


    constructor(client) {

        const foreigners = [
            [ "ticket", "id_ticket", "get_ticket_id" ],
            [ "author", "id_author", "get_user_id" ]
        ]

        super(client, "scrims_ticket_message", "get_ticket_messages", foreigners, { defaultTTL: 0, maxKeys: 0 });

    }
    

}

class TicketTypeTable extends DBTable {


    constructor(client) {

        super(client, "scrims_ticket_type", null, [], { defaultTTL: -1, maxKeys: -1 });

    }


}

class TicketStatusTable extends DBTable {

    constructor(client) {

        super(client, "scrims_ticket_status", null, [], { defaultTTL: -1, maxKeys: -1 });

    }

}

class TicketTable extends DBTable {


    constructor(client) {

        const foreigners = [
            [ "user", "id_user", "get_user_id" ],
            [ "type", "id_type", "get_ticket_type_id" ],
            [ "status", "id_status", "get_ticket_status_id" ]
        ]

        super(client, "scrims_ticket", "get_tickets", foreigners, { defaultTTL: -1 });

    }
    

}

module.exports = { TicketMessagesTable, TicketTypeTable, TicketStatusTable, TicketTable };