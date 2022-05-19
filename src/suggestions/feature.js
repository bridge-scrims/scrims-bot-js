const SuggestionsResponseMessageBuilder = require("./responses");
const ScrimsSuggestion = require("./suggestion");
const onReactionUpdate = require("./reactions");

const { interactionHandler, listeners, contextMenus } = require("./interactions");
const { commandHandler, eventListeners, commands } = require("./commands");

const { Message } = require("discord.js");
const DynamicallyConfiguredValueUpdater = require("../lib/configed_value_updater");
const AsyncFunctionBuffer = require("../lib/buffer");

class SuggestionsFeature {

    static tables = { 

        /**
         * @type { ScrimsSuggestion.Table }
         */
        suggestions: null

    }

    constructor(bot) {

        /**
         * @type { import("../bot") }
         */
        this.bot = bot
        
        this.suggestionInfoMessageReloads = {}
        this.suggestionInfoMessages = {}
        this.suggestionChannels = {}

        this.configChangeBuffer = new AsyncFunctionBuffer((guildId) => this.onConfigurationChange(guildId))

        commands.forEach(([ cmdData, cmdPerms ]) => this.bot.commands.add(cmdData, cmdPerms))
        contextMenus.forEach(([ cmdData, cmdPerms ]) => this.bot.commands.add(cmdData, cmdPerms))

        this.database.addTable("suggestions", new ScrimsSuggestion.Table(this.database))

        this.bot.on('ready', () => this.onReady())
        this.bot.on('databaseConnected', () => this.onStartup())

    }

    get database() {

        return this.bot.database;

    }

    getVoteConst(guildId) {

        const voteConst = this.bot.getConfig(guildId, "suggestions_vote_const")
        const number = parseInt(voteConst)

        if (number && number > 0) return number;
        return null;

    }

    getChannelId(guildId) {

        return this.bot.getConfig(guildId, "suggestions_channel");

    }

    async onStartup() {

        new DynamicallyConfiguredValueUpdater(this.database, `suggestions_channel`, (guildId) => this.configChangeBuffer.run(guildId), (guildId) => this.configChangeBuffer.run(guildId))
        new DynamicallyConfiguredValueUpdater(this.database, `suggestions_vote_const`, (guildId) => this.configChangeBuffer.run(guildId), (guildId) => this.configChangeBuffer.run(guildId))

    }

    async onConfigurationChange(guildId) {

        const isConfigured = (this.getChannelId(guildId) && this.getVoteConst(guildId))
        if (!isConfigured) await this.shutDownGuild(guildId);

        if (isConfigured && this.suggestionChannels[guildId]?.id !== this.getChannelId(guildId)) await this.shutDownGuild(guildId);
        if (isConfigured && !this.suggestionChannels[guildId]) await this.startupGuild(guildId);

    }

    async sendEpicSuggestion(guild, epicEmbed, voteStatus) {

        const channelId = this.bot.getConfig(guild.id, "epic_suggestions_channel")
        if (!channelId) return false;

        const context = { guild_id: guild.id, channel_id: channelId }

        const channel = await this.bot.channels.fetch(channelId)
        context.channel_name = channel.name

        await channel.send({ embeds: [epicEmbed] })
        await channel.send({ content: voteStatus })

    }

    async startupGuild(guildId) {

        const context = { guild_id: guildId, channel_id: this.getChannelId(guildId) }

        const guild = await this.bot.guilds.fetch(guildId)
        context.guild_id = guild.id

        const channel = await this.bot.channels.fetch(this.getChannelId(guildId))
        context.channel_name = channel.name

        await this.logSuccess(`Suggestions channel found and is initializing with a critical vote ratio of ${this.getVoteConst(guildId)}.`, context)

        const messages = await channel.messages.fetch()
        await Promise.all(messages.filter(msg => (msg.components.length > 0)).map(msg => msg.delete()))

        await this.sendSuggestionInfoMessage(channel, true)

    }

    async shutDownGuild(guildId) {

        clearTimeout(this.suggestionInfoMessageReloads[guildId])
        
        if (this.suggestionInfoMessages[guildId] instanceof Message) {

            const guild = this.suggestionInfoMessages[guildId].guild
            await this.logError(`Suggestions unconfigured.`, { guild_id: guild.id })

            await this.suggestionInfoMessages[guildId].delete().catch(() => null);

        }

        delete this.suggestionChannels[guildId]

    }

    async onChannelDelete(channel) {

        if (this.suggestionChannels[channel.guild.id]?.id != channel.id) return false;
        
        const context = { 

            guild_id: channel.guild.id,

            channel_name: channel.name, 
            executor_id: channel?.executor?.id

        }

        await this.logError(`Deleted the suggestions channel!`, context)
        await this.shutDownGuild(channel.guild.id)

    }

    async onReady() {

        this.bot.on('scrimsMessageCreate', message => this.onMessageCreate(message))
        this.bot.on('scrimsMessageDelete', message => this.onMessageDelete(message))

        this.bot.on('scrimsReactionRemove', reaction => this.onReactionUpdate(reaction))
        this.bot.on('scrimsReactionAdd', reaction => this.onReactionUpdate(reaction))

        this.bot.on('scrimsChannelDelete', channel => this.onChannelDelete(channel))

        this.addEventHandlers()

    }

    async logError(msg, context) {

        if (context.error) console.error(`${msg} Reason: ${context.error}`)
        this.database.ipc.notify('suggestions_error', { msg, ...context })

    }

    async logSuccess(msg, context) {

        this.database.ipc.notify(`suggestions_success`, { msg, ...context })

    }

    getVoteEmojis(guild) {

        return [["suggestion_up_vote_emoji", "👍"], ["suggestion_down_vote_emoji", "👎"]]
            .map(([key, def]) => guild.emojis.resolve(this.bot.getConfig(guild.id, key)) ?? def);

    }

    async onMessageCreate(message) { 

        const suggestionsChannel = this.suggestionChannels[message.guild.id]
        // Message was not created in the suggestions channel so we ignore it
        if (message.channel.id != suggestionsChannel?.id) return false;

        // Messages like CHANNEL_PINNED_MESSAGE & THREAD_CREATED should get deleted
        const badMessageTypes = ['CHANNEL_PINNED_MESSAGE', 'THREAD_STARTER_MESSAGE']
        if (badMessageTypes.includes(message.type)) return message.delete().catch(console.error);
    
        // This bot sent the message so don't worry about it
        if (message.author.id == this.bot.user.id) return false;
    
        // Recreate the suggestions info message so that it is displayed at the bottom of the channel
        await this.sendSuggestionInfoMessage(message.channel, false)
    
    }

    async onMessageDelete(message) {

        const suggestion = this.database.suggestions.cache.find({ message_id: message.id })[0]

        // If a suggestion message was delted it should also be deleted in the database
        await this.database.suggestions.remove({ message_id: message.id }).catch(console.error);

        if (suggestion) {

            this.database.ipc.send('audited_suggestion_remove', { suggestion, executor_id: message?.executor?.id })

        }
        
    }

    async onReactionUpdate(reaction) {

        if (reaction.userId == this.bot.user.id) return false;
        await onReactionUpdate(reaction).catch(console.error)
        
    }

    addEventHandlers() {

        listeners.forEach(eventName => this.bot.addEventHandler(eventName, interactionHandler))
        contextMenus.forEach(([ cmdData, _ ]) => this.bot.addEventHandler(cmdData.name, interactionHandler))
        commands.forEach(([ cmdData, _ ]) => this.bot.addEventHandler(cmdData.name, commandHandler))
        eventListeners.forEach(eventName => this.bot.addEventHandler(eventName, commandHandler))

    }

    async sendSuggestionInfoMessage(channel, resend) {

        const context = { guild_id: channel.guild.id, channel_name: channel.name }

        this.suggestionChannels[channel.guild.id] = channel;
        
        clearTimeout(this.suggestionInfoMessageReloads[channel.guild.id])

        await this.suggestionInfoMessages[channel.guild.id]?.delete()?.catch(() => null);
        this.suggestionInfoMessages[channel.guild.id] = await channel.send(SuggestionsResponseMessageBuilder.suggestionsInfoMessage(channel.guild.name))
            .catch(error => this.logError(`Suggestions message could not be sent!`, { ...context, error }))

        if (resend) this.suggestionInfoMessageReloads[channel.guild.id] = setTimeout(() => this.sendSuggestionInfoMessage(channel, false).catch(console.error), 7*60*1000)

    }

}

module.exports = SuggestionsFeature;