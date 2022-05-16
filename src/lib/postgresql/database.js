const Pool = require('pg-pool');
const pgIPC = require('pg-ipc');

const { v4: uuidv4 } = require("uuid");

const ScrimsTicketMessageAttachment = require("../scrims/ticket_message_attachment");
const ScrimsSessionParticipant = require('../scrims/session_participant');
const ScrimsGuildEntryType = require("../scrims/guild_entry_type");
const ScrimsTicketMessage = require("../scrims/ticket_message");
const ScrimsUserPosition = require("../scrims/user_position");
const ScrimsPositionRole = require("../scrims/position_role");
const ScrimsTicketStatus = require("../scrims/ticket_status");
const ScrimsSessionType = require('../scrims/session_type');
const ScrimsGuildEntry = require("../scrims/guild_entry");
const ScrimsTicketType = require("../scrims/ticket_type");
const ScrimsAttachment = require('../scrims/attachment');
const ScrimsPosition = require('../scrims/position');
const ScrimsSession = require('../scrims/session');
const ScrimsTicket = require("../scrims/ticket");
const ScrimsGuild = require('../scrims/guild');
const ScrimsUser = require("../scrims/user");

class DBClient {

    constructor(bot, config) {

        Object.defineProperty(this, 'bot', { value: bot });

        /**
         * @type { import('../bot') }
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
        
        /**
         * @type { ScrimsAttachment.Table }
         */
        this.attachments 

        /**
         * @type { ScrimsGuild.Table }
         */
        this.guilds

        /**
         * @type { ScrimsUser.Table }
         */
        this.users

        /**
         * @type { ScrimsPosition.Table }
         */
        this.positions

        /**
         * @type { ScrimsUserPosition.Table }
         */
        this.userPositions

        /**
         * @type { ScrimsPositionRole.Table }
         */
        this.positionRoles
 
        /**
         * @type { ScrimsGuildEntryType.Table }
         */
        this.guildEntryTypes

        /**
         * @type { ScrimsGuildEntry.Table }
         */
        this.guildEntrys

        /**
         * @type { ScrimsTicketType.Table }
         */
        this.ticketTypes

        /**
         * @type { ScrimsTicketStatus.Table }
         */
        this.ticketStatuses

        /**
         * @type { ScrimsTicket.Table }
         */
        this.tickets

        /**
         * @type { ScrimsTicketMessage.Table }
         */
        this.ticketMessages

        /**
         * @type { ScrimsTicketMessageAttachment.Table }
         */
        this.ticketMessageAttachments

        /**
         * @type { ScrimsSession.Table }
         */
        this.sessions

        /**
         * @type { ScrimsSessionType.Table }
         */
        this.sessionTypes

        /**
         * @type { ScrimsSessionParticipant.Table }
         */
        this.sessionParticipants

    }

    __addScrimsTables() {

        this.addTable("attachments", new ScrimsAttachment.Table(this))

        this.addTable("guilds", new ScrimsGuild.Table(this))
        this.addTable("users", new ScrimsUser.Table(this))

        this.addTable("positions", new ScrimsPosition.Table(this))
        this.addTable("userPositions", new ScrimsUserPosition.Table(this))
        
        this.addTable("positionRoles", new ScrimsPositionRole.Table(this))

        this.addTable("guildEntryTypes", new ScrimsGuildEntryType.Table(this))
        this.addTable("guildEntrys", new ScrimsGuildEntry.Table(this))

        this.addTable("ticketTypes", new ScrimsTicketType.Table(this))
        this.addTable("ticketStatuses", new ScrimsTicketStatus.Table(this))
        this.addTable("tickets", new ScrimsTicket.Table(this))
        this.addTable("ticketMessages", new ScrimsTicketMessage.Table(this))
        this.addTable("ticketMessageAttachments", new ScrimsTicketMessageAttachment.Table(this))

        this.addTable("sessions", new ScrimsSession.Table(this))
        this.addTable("sessionTypes", new ScrimsSessionType.Table(this))
        this.addTable("sessionParticipants", new ScrimsSessionParticipant.Table(this))

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

        for (let table of this.tables) await table.connect()
        this.tables = []

    }
    
    async query(...args) {

        return this.pool.query(...args);
        
    }
  
}

module.exports = DBClient;