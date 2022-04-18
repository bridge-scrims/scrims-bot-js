const SuggestionsResponseMessageBuilder = require("./responses");
const ScrimsSuggestion = require("./suggestion");
const onReactionUpdate = require("./reactions");

const { interactionHandler, contextMenus } = require("./interactions");
const { commandHandler, eventListeners, commands } = require("./commands");

const { Message } = require("discord.js");

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

    async onStartup() {

        const channelConfigs = this.database.guildEntrys.cache.get({ type: { name: "suggestions_channel" } })
        const configured = channelConfigs.filter(entry => this.getVoteConst(entry.guild_id))

        await Promise.all(configured.map(entry => this.startupGuild(entry.guild_id, entry.value)))

        this.database.guildEntrys.cache.on('push', config => this.onConfigCreate(config))
        this.database.guildEntrys.cache.on('update', config => this.onConfigCreate(config))
        this.database.guildEntrys.cache.on('remove', config => this.onConfigRemove(config))
        
    }

    async onConfigRemove(config) {

        if (config.type.name == "suggestions_channel" || config.type.name == "suggestions_vote_const") {

            await this.shutDownGuild(config.guild_id)

        }

    }

    async onConfigCreate(config) {

        if (config.type.name == "suggestions_vote_const") {

            if (!this.getVoteConst(config.guild_id)) return this.shutDownGuild(config.guild_id);    

        }

        if (config.type.name == "suggestions_vote_const" || config.type.name == "suggestions_channel") {

            await this.shutDownGuild(config.guild_id)

            const channelId = this.bot.getConfig(config.guild_id, "suggestions_channel")
            if (channelId && this.getVoteConst(config.guild_id)) await this.startupGuild(config.guild_id, channelId)

        }

    }

    async sendEpicSuggestion(guild, epicEmbed, voteStatus) {

        const channelId = this.bot.getConfig(guild.id, "epic_suggestions_channel")
        if (!channelId) return false;

        const context = { guild_id: guild.id, channel_id: channelId }

        const channel = await this.bot.channels.fetch(channelId)
            .catch(error => this.logError(`Epic suggestions channel could not be fetched!`, { ...context, error }))
    
        context.channel_name = channel.name

        await channel.send({ embeds: [epicEmbed] })
            .catch(error => this.logError(`Could not send epic suggestion in epic suggestions channel!`, { ...context, error }))

        await channel.send({ content: voteStatus })
            .catch(error => this.logError(`Could not send epic suggestion in epic suggestions channel!`, { ...context, error }))

    }

    async startupGuild(guildId, channelId) {

        const context = { guild_id: guildId, channel_id: channelId }

        const guild = await this.bot.guilds.fetch(guildId)
            .catch(error => this.logError(`Suggestions guild could not be fetched!`, { ...context, error }))
        if (!guild) return false;

        context.guild_id = guild.id

        const channel = await this.bot.channels.fetch(channelId)
            .catch(error => this.logError(`Suggestions channel could not be fetched!`, { ...context, error }))
        if (!channel) return false;
        
        context.channel_name = channel.name

        await this.logSuccess(`Suggestions channel found and is initializing with a critical vote ratio of ${this.getVoteConst(guildId)}.`, { ...context, executor_id: this.bot.user.id })

        const messages = await channel.messages.fetch()
            .catch(error => this.logError(`Suggestions channel messages could not be fetched!`, { ...context, error }))

        await Promise.all(messages.filter(msg => (msg.components.length > 0)).map(msg => msg.delete()))
            .catch(error => this.logError(`Suggestions info messages could not be deleted!`, { ...context, error }))

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

        const suggestion = this.database.suggestions.cache.get({ message_id: message.id })[0]

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

        this.bot.addEventHandler("suggestion", interactionHandler)

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