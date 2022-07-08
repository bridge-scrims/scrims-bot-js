const Pool = require('pg-pool');
const pgIPC = require('pg-ipc');

const { v4: uuidv4 } = require("uuid");

const ScrimsTicketStatus = require("../scrims/ticket_status");
const ScrimsTicketType = require("../scrims/ticket_type");
const ScrimsTicket = require("../scrims/ticket");
const ScrimsGuild = require('../scrims/guild');
const ScrimsUser = require("../scrims/user");
const DBTable = require('./table');
const ScrimsGuildEntry = require('../scrims/guild_entry');
const ScrimsPosition = require('../scrims/position');
const ScrimsPositionRole = require('../scrims/position_role');
const ScrimsUserPosition = require('../scrims/user_position');
const ScrimsGuildEntryType = require('../scrims/guild_entry_type');
const ScrimsAttachment = require('../scrims/attachment');
const ScrimsTicketMessage = require('../scrims/ticket_message');
const ScrimsTicketMessageAttachment = require('../scrims/ticket_message_attachment');
const ScrimsSession = require('../scrims/session');
const ScrimsSessionType = require('../scrims/session_type');
const ScrimsSuggestion = require('../scrims/suggestion');

const ScrimsUserPositionTable = require("../scrims/user_position_table");
const ScrimsUserTable = require("../scrims/user_table");
const PendingUserMerge = require('../scrims/pending_user_merge');

class DBClient {

    constructor(config, bot=null) {

        Object.defineProperty(this, 'bot', { value: bot });

        /**
         * @type {import('../bot') | null}
         * @readonly
         */
        this.bot

        this.pool = new Pool({

            user: config.username,
            password: config.password,
            host: config.hostname,
            port: config.port,
            database: config.database

        })

        this.pool.on('error', error => console.error(`Unexpected pgsql pool error ${error}!`))

        this.tables = []
        this.__addScrimsTables()
        
        /** @type {DBTable<ScrimsGuild>} */
        this.guilds

        /** @type {ScrimsUserTable} */
        this.users

        /** @type {DBTable<ScrimsPosition>} */
        this.positions

        /** @type {DBTable<ScrimsAttachment>} */
        this.attachments

        /** @type {DBTable<ScrimsPositionRole>} */
        this.positionRoles

        /** @type {ScrimsUserPositionTable} */
        this.userPositions

        /** @type {DBTable<ScrimsGuildEntryType} */
        this.guildEntryTypes

        /** @type {DBTable<ScrimsGuildEntry>} */
        this.guildEntrys

        /** @type {DBTable<ScrimsTicketMessage>} */
        this.ticketMessages

        /** @type {DBTable<ScrimsTicketMessageAttachment>} */
        this.ticketMessageAttachments

        /** @type {DBTable<ScrimsTicketType>} */
        this.ticketTypes

        /** @type {DBTable<ScrimsTicketStatus>} */
        this.ticketStatuses

        /** @type {DBTable<ScrimsTicket>} */
        this.tickets

        /** @type {DBTable<ScrimsSessionType>} */
        this.sessionTypes

        /** @type {DBTable<ScrimsSession>} */
        this.sessions

        /** @type {DBTable<ScrimsSuggestion} */
        this.suggestions


        /** @type {DBTable<PendingUserMerge>} */
        this.pendingUserMerges

    }

    __addScrimsTables() {

        this.addTable("guilds", new DBTable(this, 'scrims_guild', null, { lifeTime: -1 }, [], ScrimsGuild))
        this.addTable("users", new ScrimsUserTable(this))
        this.addTable("positions", new DBTable(this, "scrims_position", null, { lifeTime: -1 }, [], ScrimsPosition))
        this.addTable("attachments", new DBTable(this, "scrims_attachment", null, { lifeTime: -1 }, [], ScrimsAttachment))

        this.addTable("positionRoles", new DBTable(this, "scrims_position_role", "get_position_roles", { lifeTime: -1 }, [ ["position", "id_position", "get_position_id"] ], ScrimsPositionRole))
        this.addTable("userPositions", new ScrimsUserPositionTable(this))
        
        this.addTable("guildEntryTypes", new DBTable(this, "scrims_guild_entry_type", null, { lifeTime: -1 }, [], ScrimsGuildEntryType))
        this.addTable("guildEntrys", new DBTable(this, "scrims_guild_entry", "get_guild_entrys", { lifeTime: -1 }, [ ["type", "id_type", "get_guild_entry_type_id"] ], ScrimsGuildEntry))

        this.addTable("ticketMessages", new DBTable(this, "scrims_ticket_message", null, {}, [ ["ticket", "id_ticket", "get_ticket_id"], ["author", "id_author", "get_user_id"] ], ScrimsTicketMessage))
        this.addTable("ticketMessageAttachments", new DBTable(this, "scrims_ticket_message_attachment", "get_ticket_message_attachments", {}, [ ["ticket", "id_ticket", "get_ticket_id"], ["attachment", "attachment_id", "get_attachment_id"] ], ScrimsTicketMessageAttachment))

        this.addTable("ticketTypes", new DBTable(this, 'scrims_ticket_type', null, { lifeTime: -1 }, [], ScrimsTicketType))
        this.addTable("ticketStatuses", new DBTable(this, 'scrims_ticket_status', null, { lifeTime: -1 }, [], ScrimsTicketStatus))

        const ticketForeigners = [
            [ "user", "id_user", "get_user_id" ],
            [ "type", "id_type", "get_ticket_type_id" ],
            [ "status", "id_status", "get_ticket_status_id" ],
            [ "closer", "id_closer", "get_user_id" ]
        ]
        this.addTable("tickets", new DBTable(this, 'scrims_ticket', 'get_tickets', {}, ticketForeigners, ScrimsTicket))

        this.addTable("sessionTypes", new DBTable(this, "scrims_session_type", null, { lifeTime: -1 }, [], ScrimsSessionType))
        this.addTable("sessions", new DBTable(this, "scrims_session", "get_sessions", {}, [ ["type", "id_type", "get_session_type_id"], ["creator", "id_creator", "get_user_id"] ], ScrimsSession))

        const suggestionForeigners = [ ["creator", "id_creator", "get_user_id"], ["attachment", "id_attachment", "get_attachment_id"] ]
        this.addTable("suggestions", new DBTable(this, "scrims_suggestion", "get_suggestions", {}, suggestionForeigners, ScrimsSuggestion))
        
        const vouchForeigners = [
            ["user", "id_user", "get_user_id"],
            ["position", "id_position", "get_position_id"],
            ["executor", "id_executor", "get_user_id"]
        ]

        this.addTable("pendingUserMerges", new DBTable(this, "pending_user_merge", null, {}, [[ "to_link", "id_to_link", "get_user_id" ]], PendingUserMerge))
    }

    generateUUID() {

        return uuidv4();

    }

    addTable(key, table) {

        this.tables.push(table)
        this[key] = table

    }

    async connect() {

        this.ipcClient = await this.pool.connect()
        this.ipcClient.on('error', error => console.error(`Unexpected pgsql ipc client error ${error}!`))

        this.ipc = pgIPC(this.ipcClient)
        this.ipc.on('error', error => console.error(`Unexpected pgsql ipc error ${error}!`))

        console.log("Initializing cache...")
        await this.initializeCache()

    }

    async destroy() {

        await this.ipc?.end()
        await this.pool?.end()

    }
 
    async initializeCache() {

        for (const table of this.tables) await table.connect()
        this.tables = []

    }
    
    /**
     * @param {string} queryText 
     * @param {any[]} values
     */
    async query(queryText, values) {

        return this.pool.query(queryText, values);
        
    }
  
}

module.exports = DBClient;