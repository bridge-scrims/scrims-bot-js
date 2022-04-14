const TicketTranscriber = require("./ticket-transcriber");
const ScrimsMessageBuilder = require("../lib/responses");

const { commandHandler, commands } = require("./commands");

const onComponent = require("./components");
const onSubmit = require("./modals");

class SupportFeature {

    constructor(bot) {

        /**
         * @type { import("../bot") }
         */
        this.bot = bot

        commands.forEach(([ cmdData, cmdPerms ]) => this.bot.commands.add(cmdData, cmdPerms))

        this.transcriptChannels = {}
        this.ticketCategorys = {}

        bot.on('ready', () => this.onReady())

    }

    get database() {

        return this.bot.database;

    }

    async onReady() {

        this.transcriber = new TicketTranscriber(this.database.ticketMessages)

        const channelConfigs = this.database.guildEntrys.cache.get({ type: { name: "tickets_transcript_channel" } })
        await Promise.all(channelConfigs.map(entry => this.setTranscriptChannel(entry.guild_id, entry.value)))

        this.database.guildEntrys.cache.on('push', config => this.onConfigCreate(config))
        this.database.guildEntrys.cache.on('update', config => this.onConfigCreate(config))
        this.database.guildEntrys.cache.on('remove', config => this.onConfigRemove(config))

        this.addEventHandlers()

        this.bot.on('messageCreate', message => this.onMessageCreate(message))
        this.bot.on('messageDelete', message => this.onMessageDelete(message))
        this.bot.on('messageDeleteBulk', messages => this.onMessageDeleteBulk(messages))
        this.bot.on('messageUpdate', (oldMessage, newMessage) => this.onMessageUpdate(oldMessage, newMessage))

        this.bot.on('scrimsChannelDelete', channel => this.onChannelDelete(channel))

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

    }

    async onConfigRemove(config) {

        if (config.type.name == "tickets_transcript_channel") {

            delete this.transcriptChannels[config.guild_id]
            this.logError(`Transcript channel unconfigured!`, { guild_id: config.guild_id })

        }

        if (config.type.name == "tickets_report_category") {

            delete this.ticketCategorys[config.guild_id]?.report
            this.logError(`Ticket report category unconfigured!`, { guild_id: config.guild_id })

        }

        if (config.type.name == "tickets_support_category") {

            delete this.ticketCategorys[config.guild_id]?.support
            this.logError(`Ticket support category unconfigured!`, { guild_id: config.guild_id })

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

            this.logSuccess(`The category for ${typeName} tickets set as **${channel.name}**.`, { guild_id: guildId })
            
            if (!(guildId in this.ticketCategorys)) this.ticketCategorys[guildId] = {}
            this.ticketCategorys[guildId][typeName] = channel

        }

    }

    logError(msg, context) {

        if (context.error) console.error(`${msg} Reason: ${context.error}`)
        this.database.ipc.notify(`support_error`, { msg, ...context })

    }

    logSuccess(msg, context) {

        this.database.ipc.notify(`support_success`, { msg, ...context })

    }

    async onMessageCreate(message) {

        const ticket = this.database.tickets.cache.get({ channel_id: message.channel.id })[0]
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

        await this.database.ticketMessages.create(ticketMessage)
            .catch(error => console.error(`Unable to log support ticket message because of ${error}`, ticketMessage))

    }

    async onMessageUpdate(oldMessage, newMessage) {

        const changed = (oldMessage.content != newMessage.content)
        if (changed) return this.onMessageCreate(newMessage);

    }

    async onMessageDelete(message) {

        const ticket = this.database.tickets.cache.get({ channel_id: message.channel.id })[0]
        if (!ticket) return false;

        await this.database.ticketMessages.update({ id_ticket: ticket.id_ticket, message_id: message.id }, { deleted: Math.round(Date.now() / 1000) })
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

        const existing = await this.database.tickets.get({ type: { name: typeName }, id_user: interaction.scrimsUser.id_user, status: { name: "open" } })
        if (existing.length > 0) {

            const channel = await this.bot.channels.fetch(existing[0].channel_id).catch(() => null)
            if (channel) return interaction.reply(ScrimsMessageBuilder.errorMessage(`Already Created`, `You already have a ticket of this type open (${channel})!`)).then(() => false);

            // Ticket is open, but the channel does not exist
            await this.closeTicket({ guild: interaction.guild }, existing[0], null)
        
        }

        return true;

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

        this.logError(
            `Deleted the ${hits.join('and')} ticket category${(hits.length > 1) ? 's' : ''}!`, 
            { guild_id: channel.guild.id, executor_id: channel?.executor?.id }
        )

        const types = [ 'tickets_transcript_channel', 'tickets_report_category', 'tickets_support_category' ]
        await Promise.all(types.map(name => this.database.guildEntrys.remove({ scrimsGuild: { discord_id: channel.guild.id }, type: { name }, value: channel.id }))).catch(console.error)

        const tickets = await this.database.tickets.get({ channel_id: channel.id, status: { name: "open" } }).catch(console.error)
        await Promise.all(tickets.map(ticket => this.closeTicket(channel, ticket, channel?.executor))).catch(console.error)

    }

    async closeTicket(channel, ticket, executor) {

        this.logError(`Closed a ticket.`, { guild_id: channel.guild.id, ticket, executor_id: (executor?.id ?? null) })
        await this.transcriber.send(channel.guild, ticket)

        await this.database.tickets.update({ id_ticket: ticket.id_ticket }, { status: { name: "deleted" } })
        
        if (typeof channel.delete === "function") await channel.delete().catch(() => { /* Channel could already be deleted. */ })

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