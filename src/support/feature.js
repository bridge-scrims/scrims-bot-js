const { TicketTable, TicketMessagesTable, TicketStatusTable, TicketTypeTable } = require("./tables");
const TicketTranscriber = require("./ticket-transcriber");
const ScrimsMessageBuilder = require("../lib/responses");

const { commandHandler, commands } = require("./commands");

const onComponent = require("./components");
const onSubmit = require("./modals");

class SupportFeature {

    constructor(bot, config) {

        this.bot = bot
        this.config = config

        Object.entries(config).forEach(([key, value]) => this[key] = value)

        commands.forEach(([ cmdData, cmdPerms ]) => this.bot.commands.add(cmdData, cmdPerms))

        this.transcriptChannel = null

        bot.on('ready', () => this.onReady())

    }

    async onReady() {

        this.bot.database.tickets = new TicketTable(this.bot.database)
        this.bot.database.ticketTypes = new TicketTypeTable(this.bot.database)
        this.bot.database.ticketStatus = new TicketStatusTable(this.bot.database)
        this.bot.database.transcript = new TicketMessagesTable(this.bot.database)

        await this.bot.database.tickets.connect()
        await this.bot.database.ticketTypes.connect()
        await this.bot.database.ticketStatus.connect()
        await this.bot.database.transcript.connect()

        this.transcriber = new TicketTranscriber(this.bot.database.transcript)

        if (this.transcriptChannelId) {
            this.transcriptChannel = await this.bot.channels.fetch(this.transcriptChannelId)
                .catch(error => console.error(`Unable to get transcript channel because of ${error}!`))
            if (this.transcriptChannel) console.log("Transcript channel found and on standby!")
        }

        this.addEventHandlers()

        this.bot.on('messageCreate', message => this.onMessageCreate(message))
        this.bot.on('messageDelete', message => this.onMessageDelete(message))
        this.bot.on('messageDeleteBulk', messages => this.onMessageDeleteBulk(messages))
        this.bot.on('messageUpdate', (oldMessage, newMessage) => this.onMessageUpdate(oldMessage, newMessage))

        this.bot.on('channelDelete', channel => this.onChannelDelete(channel))

    }

    async onMessageCreate(message) {

        const ticket = this.bot.database.tickets.cache.get({ channel_id: message.channel.id })[0]
        if (!ticket) return false;

        if (message.author.id == this.bot.user.id) return false;
        if (!message.content) return false;

        const ticketMessage = {

            id_ticket: ticket.id_ticket,
            author: { discord_id: message.author.id },
            message_id: message.id,
            content: message.content,
            created_at: Math.round(Date.now() / 1000)

        }

        await this.bot.database.transcript.create(ticketMessage)
            .catch(error => console.error(`Unable to log support ticket message because of ${error}`, ticketMessage))

    }

    async onMessageUpdate(oldMessage, newMessage) {

        const changed = (oldMessage.content != newMessage.content)
        if (changed) return this.onMessageCreate(newMessage);

    }

    async onMessageDelete(message) {

        const ticket = this.bot.database.tickets.cache.get({ channel_id: message.channel.id })[0]
        if (!ticket) return false;

        await this.bot.database.transcript.update({ id_ticket: ticket.id_ticket, message_id: message.id }, { deleted: Math.round(Date.now() / 1000) })
            .catch(error => console.error(`Unable to log support ticket message deletion because of ${error}`, ticket))

    }

    async onMessageDeleteBulk(messages) {

        await Promise.all(messages.map(msg => this.onMessageDelete(msg)))

    }

    async verifyTicketRequest(interaction, typeName) {

        if (!interaction.scrimsUser)
            return interaction.reply(ScrimsMessageBuilder.scrimsUserNeededMessage()).then(() => false);

        const bannedPosition = await interaction.client.database.userPositions.get({ id_user: interaction.scrimsUser.id_user, position: { name: "support_blacklisted" } })
        if (bannedPosition.length > 0) {

            const length = bannedPosition[0].expires_at ? `until <t:${bannedPosition[0].expires_at}:f>` : `permanently`;
            return interaction.reply(
                ScrimsMessageBuilder.errorMessage(`Not Allowed`, `You are not allowed to create tickets ${length} since you didn't follow the rules.`)
            ).then(() => false);

        }

        const existing = await interaction.client.database.tickets.get({ type: { name: typeName }, id_user: interaction.scrimsUser.id_user, status: { name: "open" } })
        if (existing.length > 0)
            return interaction.reply(ScrimsMessageBuilder.errorMessage(`Already Created`, `You already have a ticket of this type open (<#${existing[0].channel_id}>)!`)).then(() => false);

        return true;

    }

    async onChannelDelete(channel) {

        const tickets = await this.bot.database.tickets.get({ channel_id: channel.id, status: { name: "open" } }).catch(console.error)
        await Promise.all(tickets.map(ticket => this.closeTicket(channel, ticket))).catch(console.error)

    }

    async closeTicket(channel, ticket) {

        await this.transcriber.send(channel.guild, ticket)

        await this.bot.database.tickets.update({ id_ticket: ticket.id_ticket }, { status: { name: "deleted" } })
        await channel.delete().catch(() => { /* Channel could already be deleted. */ })

    }

    addEventHandlers() {

        this.bot.addEventHandler("support", onComponent)
        this.bot.addEventHandler("report", onComponent)
        this.bot.addEventHandler("TicketCloseRequest", onComponent)

        commands.forEach(([ cmdData, _ ]) => this.bot.addEventHandler(cmdData.name, commandHandler))

        this.bot.addEventHandler("support-modal", onSubmit)

    }

}

module.exports = SupportFeature;