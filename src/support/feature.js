const TicketTranscriber = require("./ticket-transcriber");
const ScrimsMessageBuilder = require("../lib/responses");

const { commandHandler, eventHandlers, commands } = require("./interactions");
const SupportResponseMessageBuilder = require("./responses");
const { SnowflakeUtil } = require("discord.js");

class SupportFeature {

    constructor(bot) {

        /**
         * @type { import("../bot") }
         */
        this.bot = bot

        commands.forEach(([ cmdData, cmdPerms ]) => this.bot.commands.add(cmdData, cmdPerms))

        this.modalResponses = {}
        this.transcriptChannels = {}
        this.ticketCategorys = {}

        this.statusChannel = null

        bot.on('databaseConnected', () => this.onReady())

    }

    get database() {

        return this.bot.database;

    }

    async onReady() {

        this.transcriber = new TicketTranscriber(this.database)

        const channelConfigs = this.database.guildEntrys.cache.find({ type: { name: "tickets_transcript_channel" } })
        await Promise.all(channelConfigs.map(entry => this.setTranscriptChannel(entry.guild_id, entry.value)))

        const reportCategoryConfigs = this.database.guildEntrys.cache.find({ type: { name: "tickets_report_category" } })
        await Promise.all(reportCategoryConfigs.map(entry => this.setTicketsCategory(entry.guild_id, entry.value, 'report')))

        const supportCategoryConfigs = this.database.guildEntrys.cache.find({ type: { name: "tickets_support_category" } })
        await Promise.all(supportCategoryConfigs.map(entry => this.setTicketsCategory(entry.guild_id, entry.value, 'support')))

        const statusChannelConfigs = this.database.guildEntrys.cache.find({ type: { name: "tickets_status_channel" } })
        await Promise.all(statusChannelConfigs.map(entry => this.setTicketStatusChannel(entry.guild_id, entry.value)))

        this.database.guildEntrys.cache.on('push', config => this.onConfigCreate(config))
        this.database.guildEntrys.cache.on('update', config => this.onConfigCreate(config))
        this.database.guildEntrys.cache.on('remove', config => this.onConfigRemove(config))

        this.database.tickets.cache.on('push', ticket => this.onTicketStatusUpdate(ticket))
        this.database.tickets.cache.on('update', ticket => this.onTicketStatusUpdate(ticket))
        this.database.tickets.cache.on('remove', ticket => this.onTicketStatusUpdate(ticket))

        this.addEventHandlers()

        this.bot.on('messageCreate', message => this.onMessageCreate(message))
        this.bot.on('messageDelete', message => this.onMessageDelete(message))
        this.bot.on('messageDeleteBulk', messages => this.onMessageDeleteBulk(messages))
        this.bot.on('messageUpdate', (oldMessage, newMessage) => this.onMessageUpdate(oldMessage, newMessage))

        this.bot.on('scrimsChannelDelete', channel => this.onChannelDelete(channel))

    }

    async onTicketStatusUpdate(ticket) {

        if (['support', 'report'].includes(ticket.type.name) && this.statusChannel) {

            await this.updateTicketStatusChannel()

        }

    }

    async updateTicketStatusChannel() {

        const tickets = this.database.tickets.cache.values()
        const status = `${tickets.filter(t => t.status.name !== 'open').length}/${tickets.length} Tickets`
        if (this.statusChannel.name !== status) {

            await this.statusChannel.setName(status).catch(console.error)

        }

    }

    async onConfigCreate(config) {

        if (config.type.name == "tickets_transcript_channel") {

            await this.setTranscriptChannel(config.guild_id, config.value)

        }

        if (config.type.name == "tickets_report_category") {

            await this.setTicketsCategory(config.guild_id, config.value, 'report')

        }

        if (config.type.name == "tickets_support_category") {

            await this.setTicketsCategory(config.guild_id, config.value, 'support')

        }

        if (config.type.name == "tickets_status_channel") {

            await this.setTicketStatusChannel(config.guild_id, config.value)

        }
    }

    async onConfigRemove(config) {

        if (config.type.name == "tickets_transcript_channel") {

            if (this.transcriptChannels[config.guild_id]) this.logError(`Transcript channel unconfigured!`, { guild_id: config.guild_id })
            delete this.transcriptChannels[config.guild_id]

        }

        if (config.type.name == "tickets_report_category") {

            if (this.ticketCategorys[config.guild_id]?.report) this.logError(`Ticket report category unconfigured!`, { guild_id: config.guild_id })
            delete this.ticketCategorys[config.guild_id]?.report

        }

        if (config.type.name == "tickets_support_category") {

            if (this.ticketCategorys[config.guild_id]?.support) this.logError(`Ticket support category unconfigured!`, { guild_id: config.guild_id })
            delete this.ticketCategorys[config.guild_id]?.support

        }

        if (config.type.name == "tickets_status_channel") {

            if (this.statusChannel) this.logError(`Ticket status channel unconfigured!`, { guild_id: config.guild_id })
            this.statusChannel = null

        }

    }

    getTicketCategory(guildId, typeName) {

        if (!(guildId in this.ticketCategorys)) return null;

        return this.ticketCategorys[guildId][typeName] ?? null;

    }

    getTranscriptChannel(guildId) {

        return this.transcriptChannels[guildId] ?? null;

    }

    async setTranscriptChannel(guildId, channelId) {

        const channel = await this.bot.channels.fetch(channelId)
            .catch(error => this.logError(`Fetching tickets transcript channel failed!`, { guild_id: guildId, error }))

        if (channel) {

            this.logSuccess(`Transcript channel set as **${channel.name}**.`, { guild_id: guildId })
            this.transcriptChannels[guildId] = channel

        }

    }

    async setTicketsCategory(guildId, channelId, typeName) {

        const channel = await this.bot.channels.fetch(channelId)
            .catch(error => this.logError(`Fetching ${typeName} ticket category failed!`, { guild_id: guildId, error }))

        if (channel) {

            this.logSuccess(`The category for \`${typeName}\` tickets set as **${channel}**.`, { guild_id: guildId })
            
            if (!(guildId in this.ticketCategorys)) this.ticketCategorys[guildId] = {}
            this.ticketCategorys[guildId][typeName] = channel

        }

    }

    async setTicketStatusChannel(guild_id, channelId) {

        const channel = await this.bot.channels.fetch(channelId)
            .catch(error => this.logError(`Fetching ticket status channel failed!`, { guild_id, error }))

        if (channel) {

            this.logSuccess(`The ticket status channel set as **${channel}**.`, { guild_id })
            this.statusChannel = channel
            await this.updateTicketStatusChannel()

        }

    }

    logError(msg, context) {

        if (context.error) console.error(`${msg} Reason: ${context.error}`)
        this.database.ipc.notify(`ticket_error`, { msg, ...context })

    }

    logSuccess(msg, context) {

        this.database.ipc.notify(`ticket_success`, { msg, ...context })

    }

    async onMessageCreate(message) {

        const ticket = this.database.tickets.cache.find({ channel_id: message.channel.id })[0]
        if (!ticket) return false;

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

        const ticket = this.database.tickets.cache.find({ channel_id: message.channel.id })[0]
        if (!ticket) return false;

        await this.database.ticketMessages.update({ id_ticket: ticket.id_ticket, message_id: message.id }, { deleted: Math.round(Date.now() / 1000) })
            .catch(error => console.error(`Unable to log support ticket message deletion because of ${error}`, ticket))

    }

    async onMessageDeleteBulk(messages) {

        await Promise.all(messages.map(msg => this.onMessageDelete(msg)))

    }

    async verifyTicketRequest(interaction, typeName) {

        if (!interaction.scrimsUser) return ScrimsMessageBuilder.scrimsUserNeededMessage()

        const bannedPosition = await interaction.client.database.userPositions.get({ id_user: interaction.scrimsUser.id_user, position: { name: "support_blacklisted" } })
        if (bannedPosition.length > 0) {

            const length = bannedPosition[0].expires_at ? `until <t:${bannedPosition[0].expires_at}:f>` : `permanently`;
            
            return ScrimsMessageBuilder.errorMessage(`Not Allowed`, `You are not allowed to create tickets ${length} since you didn't follow the rules.`)

        }

        const existing = await this.database.tickets.get({ type: { name: typeName }, id_user: interaction.scrimsUser.id_user, status: { name: "open" } })
        if (existing.length > 0) {
            
            const channel = await this.bot.channels.fetch(existing[0].channel_id).catch(() => null)
            if (channel) {
                
                return ScrimsMessageBuilder.errorMessage(`Already Created`, `You already have a ticket of this type open (${channel})!`)

            }

            // Ticket is open, but the channel does not exist
            await this.closeTicket({ guild: interaction.guild }, existing[0], null)
        
        }

        return true;

    }

    async getSupportRole(guild) {

        const positionRoles = await this.database.positionRoles.get({ guild_id: guild.id, position: { name: 'support' } })
        if (positionRoles.length === 0) return null;
    
        const role = guild.roles.resolve(positionRoles[0].role_id)
        return role ?? null;
    
    }

    async getTicketInfoPayload(member, mentionRoles, ticketData) {

        const supportRole = await this.getSupportRole(member.guild)

        return SupportResponseMessageBuilder.ticketInfoMessage(member, mentionRoles, supportRole, ticketData);
    
    }

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
        
        const types = [ 'tickets_transcript_channel', 'tickets_report_category', 'tickets_support_category' ]
        await Promise.all(types.map(name => this.database.guildEntrys.remove({ guild_id: channel.guild.id, type: { name }, value: channel.id }))).catch(console.error)

        if (this.statusChannel?.id === channel.id) {

            this.statusChannel = null
            this.logError(`Deleted the tickets status channel!`, { guild_id: channel.guild.id, executor_id: channel?.executor?.id })
            this.database.guildEntrys.remove({ guild_id: channel.guild.id, type: { name: "tickets_status_channel" }, value: channel.id })

        }

        const tickets = await this.database.tickets.get({ channel_id: channel.id }).catch(console.error)
        if (tickets) {
            
            const openTickets = tickets.filter(ticket => ticket.status.name !== "deleted")
            await Promise.all(openTickets.map(ticket => this.closeTicket(channel, ticket, channel?.executor, `deleted the ticket channel`))).catch(console.error)

        }

    }

    async closeTicket(channel, ticket, executor, content) {

        const statusName = ticket?.status?.name
        const closer = (executor?.id) ? { closer: { discord_id: executor.id } } : { id_closer: null }
        await this.database.tickets.update({ id_ticket: ticket.id_ticket }, { status: { name: "deleted" }, ...closer })

        if (!statusName || statusName !== 'deleted') {

            if (content && executor) {
                const message = { id: SnowflakeUtil.generate(), author: executor, content }
                await this.transcriber.transcribe(ticket.id_ticket, message)
            }
            
            this.database.ipc.notify('ticket_closed', { guild_id: channel.guild.id, ticket, executor_id: (executor?.id ?? null) })
            await this.transcriber.send(channel.guild, ticket)
      
            if (typeof channel.delete === "function") await channel.delete().catch(() => { /* Channel could already be deleted. */ })

        }

    }

    addEventHandlers() {

        commands.forEach(([ cmdData, _ ]) => this.bot.addEventHandler(cmdData.name, commandHandler))
        eventHandlers.forEach(eventName => this.bot.addEventHandler(eventName, commandHandler))

    }

}

module.exports = SupportFeature;