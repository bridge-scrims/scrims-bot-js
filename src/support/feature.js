const { SnowflakeUtil, GuildChannel } = require("discord.js");

const DynamicallyConfiguredValueUpdater = require("../lib/tools/configed_value_updater");
const StatusChannel = require("../lib/components/status_channel");
const SupportResponseMessageBuilder = require("./responses");
const TicketTranscriber = require("./ticket-transcriber");
const ScrimsMessageBuilder = require("../lib/responses");

const { commandHandler, commands } = require("./interactions");
const ScrimsTicket = require("../lib/scrims/ticket");
const AsyncFunctionBuffer = require("../lib/tools/buffer");

const TICKET_TYPES = ["report", "support", "tournament"]
class SupportFeature {

    constructor(bot) {

        /**
         * @type { import("../bot") }
         */
        this.bot = bot

        commands.forEach(([cmdData, cmdPerms, cmdOptions]) => this.bot.commands.add(cmdData, commandHandler, cmdPerms, cmdOptions))
        this.bot.commands.add("support", commandHandler, {}, { denyWhenBlocked: true })

        this.modalResponses = {}
        this.transcriptChannels = {}
        this.ticketCategorys = {}

        this.closeTicketBuffer = new AsyncFunctionBuffer((...args) => this.__closeTicket(...args))

        /** @type {Object.<string, StatusChannel>} */
        this.statusChannels = {}

        /** @type {Object.<string, NodeJS.Timeout} */
        this.closeRequestTimeouts = {}

        /** @type {Object.<string, Array.<string>>} */
        this.ticketCloseRequest = {}

        bot.on('databaseConnected', () => this.onReady())
        bot.on('startupComplete', () => this.onStartup())

    }

    get database() {

        return this.bot.database;

    }

    async onReady() {

        this.transcriber = new TicketTranscriber(this.database)

        new DynamicallyConfiguredValueUpdater(
            this.bot, `tickets_transcript_channel`,
            (...args) => this.setTranscriptChannel(...args),
            (guildId) => this.onTranscriptChannelDelete(guildId)
        )

        new DynamicallyConfiguredValueUpdater(
            this.bot, `tickets_report_category`,
            (guildId, channelId) => this.setTicketsCategory(guildId, channelId, 'report'),
            (guildId) => this.onTicketCategoryDelete(guildId, 'report')
        )

        new DynamicallyConfiguredValueUpdater(
            this.bot, `tickets_tournament_category`,
            (guildId, channelId) => this.setTicketsCategory(guildId, channelId, 'tournament'),
            (guildId) => this.onTicketCategoryDelete(guildId, 'tournament')
        )

        new DynamicallyConfiguredValueUpdater(
            this.bot, `tickets_support_category`,
            (guildId, channelId) => this.setTicketsCategory(guildId, channelId, 'support'),
            (guildId) => this.onTicketCategoryDelete(guildId, 'support')
        )

        new DynamicallyConfiguredValueUpdater(
            this.bot, `tickets_status_channel`,
            (...args) => this.setTicketStatusChannel(...args),
            (guildId) => this.onStatusChannelDelete(guildId)
        )

        this.database.tickets.cache.on('change', ticket => this.onTicketStatusUpdate(ticket).catch(console.error))

    }

    async onStartup() {

        this.addEventHandlers()

        await this.deleteGhostTickets().catch(console.error)
        setInterval(() => this.deleteGhostTickets().catch(console.error), 5 * 60 * 1000)

    }

    async deleteGhostTickets() {

        const existingTickets = this.database.tickets.cache.filter(ticket => TICKET_TYPES.includes(ticket.type.name) && ticket.status.name !== 'deleted')
        for (const ticket of existingTickets) {

            if (ticket?.discordGuild?.me && !(await ticket.fetchChannel())) {

                await this.closeTicket(
                    ticket, null, this.bot.user,
                    `closed this ticket because of the channel no longer existing`
                ).catch(console.error)

            }

        }

    }

    cancelCloseTimeout(messageId) {

        if (messageId in this.closeRequestTimeouts) {
            clearTimeout(this.closeRequestTimeouts[messageId])
            delete this.closeRequestTimeouts[messageId]
        }

        if (messageId in this.ticketCloseRequest) {
            this.ticketCloseRequest[messageId].forEach(v => this.cancelCloseTimeout(v))
            delete this.ticketCloseRequest[messageId]
        }

    }

    async onTicketStatusUpdate(ticket) {

        if (TICKET_TYPES.includes(ticket.type.name)) {
            await this.updateTicketStatusChannel(ticket.guild_id)
        }

    }

    async updateTicketStatusChannel(guildId) {

        const statusChannel = this.statusChannels[guildId]
        if (!statusChannel) return false;

        const totalTickets = await this.database.tickets.count(TICKET_TYPES.map(name => ({ guild_id: guildId, type: { name } })))
        const finishedTickets = await this.database.tickets.count(TICKET_TYPES.map(typeName => ['closed', 'deleted'].map(name => ({ guild_id: guildId, status: { name }, type: { name: typeName } }))).flat())
        const status = `${finishedTickets}/${totalTickets} Tickets`
        await statusChannel.update(status).catch(console.error)

    }

    getTicketCategory(guildId, typeName) {

        if (!(guildId in this.ticketCategorys)) return null;
        return this.ticketCategorys[guildId][typeName] ?? null;

    }

    getTranscriptChannel(guildId) {

        return this.transcriptChannels[guildId] ?? null;

    }

    async onTranscriptChannelDelete(guild_id) {

        if (this.getTranscriptChannel(guild_id)) {

            this.logError(`Transcript channel unconfigured!`, { guild_id })
            delete this.transcriptChannels[guild_id]

        }

    }

    async onTicketCategoryDelete(guild_id, typeName) {

        if (this.getTicketCategory(guild_id, typeName)) {

            this.logError(`Ticket ${typeName} category unconfigured!`, { guild_id })
            delete this.ticketCategorys[guild_id][typeName]

        }

    }

    async onStatusChannelDelete(guild_id) {

        if (this.statusChannels[guild_id]) {

            this.logError(`Ticket status channel unconfigured!`, { guild_id })
            this.statusChannels[guild_id].destroy()
            delete this.statusChannels[guild_id]

        }

    }

    async setTranscriptChannel(guildId, channelId) {

        if (this.getTranscriptChannel(guildId)?.id === channelId) return true;
        const channel = await this.bot.channels.fetch(channelId).catch(console.error)
        if (channel) {
            this.transcriptChannels[guildId] = channel
        }

    }

    async setTicketsCategory(guildId, channelId, typeName) {

        const channel = await this.bot.channels.fetch(channelId).catch(console.error)
        if (channel) {
            if (!(guildId in this.ticketCategorys)) this.ticketCategorys[guildId] = {}
            this.ticketCategorys[guildId][typeName] = channel
        }

    }

    async setTicketStatusChannel(guild_id, channelId) {

        const channel = await this.bot.channels.fetch(channelId).catch(console.error)
        if (channel) {
            if (this.statusChannels[guild_id]) this.statusChannels[guild_id].destroy()
            this.statusChannels[guild_id] = new StatusChannel(channel)
            await this.updateTicketStatusChannel(guild_id)
        }

    }

    logError(msg, context) {

        if (context.error) console.error(`${msg} Reason: ${context.error}`)
        this.database.ipc.notify(`ticket_error`, { msg, ...context })

    }

    logSuccess(msg, context) {

        this.database.ipc.notify(`ticket_success`, { msg, ...context })

    }

    async getTicket(channel_id) {
        const ticket = await this.database.tickets.find({ channel_id })
        if (!ticket || !TICKET_TYPES.includes(ticket.type.name)) return false;
        return ticket;
    }

    async onMessageCreate(message) {

        const ticket = this.database.tickets.cache.find({ channel_id: message.channel.id })
        if (!ticket || !TICKET_TYPES.includes(ticket.type.name)) return false;

        if (message.author.id === this.bot.user.id) return false;
        if (!message.content) message.content = "";

        await this.transcriber.transcribe(ticket.id, message)
            .catch(error => console.error(`Unable to log support ticket message because of ${error}`, message))

    }

    async onMessageUpdate(oldMessage, newMessage) {

        const changed = (oldMessage.content != newMessage.content)
        if (changed) return this.onMessageCreate(newMessage);

    }

    async onMessageDelete(message) {

        this.cancelCloseTimeout(message.id)

        const ticket = this.database.tickets.cache.find({ channel_id: message.channel.id })
        if (!ticket || !TICKET_TYPES.includes(ticket.type.name)) return false;

        await this.database.ticketMessages.update({ id_ticket: ticket.id_ticket, message_id: message.id }, { deleted: Math.round(Date.now() / 1000) })
            .catch(error => console.error(`Unable to log support ticket message deletion because of ${error}`, ticket))

    }

    async onMessageDeleteBulk(messages) {

        await Promise.all(messages.map(msg => this.onMessageDelete(msg)))

    }

    async verifyTicketRequest(scrimsUser, guild_id, typeName) {

        if (!scrimsUser) return ScrimsMessageBuilder.scrimsUserNeededMessage()
        if (!TICKET_TYPES.includes(typeName)) throw new Error(`Unsupported ticket type '${typeName}' in support feature.`)

        const bannedPosition = await this.database.userPositions.find({ id_user: scrimsUser.id_user, position: { name: "support_blacklisted" } })
        if (bannedPosition) {
            return ScrimsMessageBuilder.errorMessage(`Blacklisted`, `You are not allowed to create support tickets ${bannedPosition.getDuration()} since you didn't follow the rules.`)
        }

        const existing = await this.database.tickets.find({ guild_id, type: { name: typeName }, id_user: scrimsUser.id_user, status: { name: "open" } })
        if (existing) {
            const channel = await this.bot.channels.fetch(existing.channel_id).catch(() => null)
            if (channel) {
                return ScrimsMessageBuilder.errorMessage(`Already Created`, `You already have a ticket of this type open (${channel})!`)
            }
            // Ticket is open, but the channel does not exist
            await this.closeTicket(existing, null, this.bot.user, `closed this ticket because of the channel no longer existing`)
        }
        return true;

    }

    async getSupportRole(guild) {

        const positionRole = await this.database.positionRoles.find({ guild_id: guild.id, position: { name: 'support' } })
        if (!positionRole) return null;

        const role = guild.roles.resolve(positionRole.role_id)
        return role ?? null;

    }

    async getMentionRoles(guild) {

        const positionRoles = await guild.client.database.positionRoles.fetch({ guild_id: guild.id, position: { name: "ticket_open_mention" } })
        return positionRoles.map(posRole => guild.roles.resolve(posRole.role_id)).filter(role => role);

    }

    async getTicketInfoPayload(exchange) {

        const mentionRoles = await this.getMentionRoles(exchange.guild)
        const supportRole = await this.getSupportRole(exchange.guild)
        return SupportResponseMessageBuilder.ticketInfoMessage(exchange, mentionRoles, supportRole);

    }

    /**
     * @param { GuildChannel } channel 
     */
    async onChannelDelete(channel) {

        const transcriptChannel = this.getTranscriptChannel(channel.guild.id)
        if (transcriptChannel?.id === channel.id) {

            delete this.transcriptChannels[channel.guild.id]
            this.logError(`Deleted the transcript channel!`, { guild_id: channel.guild.id, executor_id: channel?.executor?.id })

        }

        const categorys = this.ticketCategorys[channel.guild.id] ?? {}
        const hits = Object.entries(categorys).filter(([_, category]) => category.id === channel.id).map(([typeName, _]) => typeName)
        hits.forEach(typeName => delete categorys[typeName])

        if (hits.length > 0) {

            this.logError(
                `Deleted the ${hits.join('and')} ticket category${(hits.length > 1) ? 's' : ''}!`,
                { guild_id: channel.guild.id, executor_id: channel?.executor?.id }
            )

        }

        const types = ['tickets_transcript_channel', 'tickets_report_category', 'tickets_support_category', 'tickets_tournament_category']
        await Promise.all(types.map(name => this.database.guildEntrys.remove({ guild_id: channel.guild.id, type: { name }, value: channel.id }))).catch(console.error)

        if (this.statusChannels[channel.guild.id]?.id === channel.id) {

            this.statusChannels[channel.guild.id].destroy()
            delete this.statusChannels[channel.guild.id]
            this.logError(`Deleted the tickets status channel!`, { guild_id: channel.guild.id, executor_id: channel?.executor?.id })
            this.database.guildEntrys.remove({ guild_id: channel.guild.id, type: { name: "tickets_status_channel" }, value: channel.id })

        }

        const ticket = await this.database.tickets.find({ channel_id: channel.id }).catch(console.error)
        if (ticket && TICKET_TYPES.includes(ticket.type.name)) {
            this.closeTicket(ticket, channel?.executor, channel?.executor, `deleted the ticket channel`).catch(console.error)
        }

    }

    /** @param {ScrimsTicket} ticket */
    async closeTicket(ticket, ticketCloser, executor, content) {

        this.cancelCloseTimeout(ticket.id_ticket)
        await this.closeTicketBuffer.run(ticket, ticketCloser, executor, content)

    }

    /** @param {ScrimsTicket} ticket */
    async __closeTicket(ticket, ticketCloser, executor, content) {

        this.cancelCloseTimeout(ticket.id_ticket)
        if (ticket?.status?.name !== 'deleted') {

            const closer = (ticketCloser?.id) ? { closer: { discord_id: ticketCloser.id } } : { id_closer: null }
            await this.database.tickets.update({ id_ticket: ticket.id_ticket }, { status: { name: "deleted" }, ...closer })

            if (content && executor) {
                const message = { id: SnowflakeUtil.generate(), author: executor, content }
                await this.transcriber.transcribe(ticket.id_ticket, message)
            }

            this.database.ipc.notify('ticket_closed', { guild_id: ticket.guild_id, ticket, executor_id: (ticketCloser?.id ?? null) })
            if (ticket.discordGuild) await this.transcriber.send(ticket.discordGuild, ticket)

        }

        if (ticket.channel) await ticket.channel.delete().catch(() => null)

    }

    /**
     * @param { import("discord.js").PartialGuildMember } member 
     */
    async onMemberRemove(member) {

        const tickets = this.database.tickets.cache.get({ user: { discord_id: member.id } }).filter(ticket => TICKET_TYPES.includes(ticket.type.name))
        await Promise.allSettled(tickets.map(
            ticket => this.closeTicket(ticket, this.bot.user, this.bot.user, `closed this ticket because of the person leaving the server`)
                .catch(error => console.error(`Error while automatically closing ticket: ${error}!`))
        ))

    }

    addEventHandlers() {

        this.bot.on('messageCreate', message => this.onMessageCreate(message).catch(console.error))
        this.bot.on('messageDelete', message => this.onMessageDelete(message).catch(console.error))
        this.bot.on('messageDeleteBulk', messages => this.onMessageDeleteBulk(messages).catch(console.error))
        this.bot.on('messageUpdate', (oldMessage, newMessage) => this.onMessageUpdate(oldMessage, newMessage).catch(console.error))
        this.bot.scrimsEvents.on('channelDelete', channel => this.onChannelDelete(channel).catch(console.error))

        this.bot.on('guildMemberRemove', member => this.onMemberRemove(member).catch(console.error))

    }

}

module.exports = SupportFeature;