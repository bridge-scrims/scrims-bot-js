const { TicketTable, TicketMessagesTable } = require("./tables");
const TicketTranscriber = require("./ticket-transcriber");

const onCommand = require("./commands");
const onComponent = require("./components");
const onSubmit = require("./modals");

class SupportFeature {

    constructor(bot, config) {

        this.bot = bot
        this.config = config
        
        Object.entries(config).forEach(([key, value]) => this[key] = value)

        this.transcriptChannel = null
        
        bot.on('startupComplete', () => this.onReady())

    }

    async onReady() {

        this.bot.database.tickets = new TicketTable(this.bot.database)
        this.bot.database.transcript = new TicketMessagesTable(this.bot.database)
        
        await this.bot.database.tickets.connect()
        await this.bot.database.transcript.connect()

        this.transcriber = new TicketTranscriber(this.bot.database.transcript)

        if (this.transcriptChannelId) {
            this.transcriptChannel = await this.bot.channels.fetch(this.transcriptChannelId)
            console.log("Transcript channel found and on standby!")
        }

        this.bot.on('scrimsMessageCreate', message => this.onScrimsMessage(message))
        this.bot.on('scrimsCommandCreate', interaction => this.onScrimsCommand(interaction))
        this.bot.on('scrimsComponentCreate', interaction => this.onScrimsComponent(interaction))
        this.bot.on('scrimsModalSubmit', interaction => this.onScrimsModalSubmit(interaction))

    }

    async onScrimsMessage(message) {

        const ticket = this.bot.database.tickets.cache.get({ channel_id: message.channel.id })[0]
        if (!ticket) return false;

        if (message.author.id == this.bot.user.id) return false;
        if (!message.scrimsUser) return false;

        const ticketMessage = {

            id_ticket: ticket.id_ticket,
            id_author: message.scrimsUser.id_user,
            message_id: message.id,
            content: message.content,
            created_at: Math.round(message.createdTimestamp/1000)

        }

        await this.bot.database.transcript.create(ticketMessage)
            .catch(error => console.error(`Unable to log support ticket message because of ${error}`, ticketMessage))

    }

    async onScrimsCommand(interaction) {

        await onCommand(interaction).catch(console.error)

    }

    async onScrimsComponent(interaction) {

        await onComponent(interaction).catch(console.error)

    }

    async onScrimsModalSubmit(interaction) {

        const cmd = interaction?.commandName || null;
        if (cmd == "support-modal") return onSubmit(interaction).catch(console.error);

    }
    
}

module.exports = SupportFeature;