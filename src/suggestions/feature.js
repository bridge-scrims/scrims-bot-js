const SuggestionsResponseMessageBuilder = require("./responses");
const onReactionUpdate = require("./reactions");

const { interactionHandler, listeners, contextMenus } = require("./interactions");
const { commandHandler, eventListeners, commands } = require("./commands");

const { Message, TextChannel, MessageReaction } = require("discord.js");
const DynamicallyConfiguredValueUpdater = require("../lib/tools/configed_value_updater");
const AsyncFunctionBuffer = require("../lib/tools/buffer");

class SuggestionsFeature {

    constructor(bot) {

        /**
         * @type { import("../bot") }
         */
        this.bot = bot
        
        this.suggestionInfoMessageReloads = {}
        this.suggestionInfoMessages = {}

        /**
         * @type { Object.<string, TextChannel> }
         */
        this.suggestionChannels = {}

        this.configChangeBuffer = new AsyncFunctionBuffer((guildId) => this.onConfigurationChange(guildId))
        this.infoMessageBuffer = new AsyncFunctionBuffer((...args) => this.sendSuggestionInfoMessageTask(...args), -5)

        commands.forEach(([ cmdData, cmdPerms ]) => this.bot.commands.add(cmdData, commandHandler, cmdPerms))
        contextMenus.forEach(([ cmdData, cmdPerms ]) => this.bot.commands.add(cmdData, interactionHandler, cmdPerms))
        listeners.forEach(eventName => this.bot.commands.add(eventName, interactionHandler))
        eventListeners.forEach(eventName => this.bot.commands.add(eventName, commandHandler))
        this.bot.commands.add("suggestionCreate", interactionHandler, {}, { denyWhenBlocked: true })

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

    /** @param {Message} message */
    getMessageRating(message) {

        const [suggestionUpVote, suggestionDownVote] = this.getVoteEmojis(message.guild)

        const upVotes = (message.reactions.cache.get(suggestionUpVote.id ?? suggestionUpVote)?.count || 1);
        const downVotes = (message.reactions.cache.get(suggestionDownVote.id ?? suggestionDownVote)?.count || 1);
        return { upVotes, downVotes };

    }

    getChannelId(guildId) {

        return this.bot.getConfig(guildId, "suggestions_channel");

    }

    async onStartup() {

        new DynamicallyConfiguredValueUpdater(this.bot, `suggestions_channel`, (guildId) => this.configChangeBuffer.run(guildId), (guildId) => this.configChangeBuffer.run(guildId))
        new DynamicallyConfiguredValueUpdater(this.bot, `suggestions_vote_const`, (guildId) => this.configChangeBuffer.run(guildId), (guildId) => this.configChangeBuffer.run(guildId))

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

        const messages = await channel.messages.fetch()
        await Promise.all(messages.filter(msg => (msg.components.length > 0) && msg.author.id === this.bot.user.id).map(msg => msg.delete()))

        await this.sendSuggestionInfoMessage(channel, true)

    }

    async removeOldMessages() {

        await Promise.all(
            Object.values(this.suggestionChannels).map(async channel => {
                const messages = await channel.messages.fetch({ limit: 10 }).then(msgs => msgs.sort((a, b) => b.createdTimestamp - a.createdTimestamp))
                await Promise.all(
                    [...messages.values()]
                        .filter(msg => (msg.components.length > 0) && msg.author.id === this.bot.user.id)
                        .slice(1)
                        .map(msg => msg.delete())
                )
            })
        )

    }

    async shutDownGuild(guildId) {

        clearTimeout(this.suggestionInfoMessageReloads[guildId])
        
        if (this.suggestionInfoMessages[guildId] instanceof Message) {

            const guild = this.suggestionInfoMessages[guildId].guild
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

        this.bot.scrimsEvents.on('messageCreate', message => this.onMessageCreate(message).catch(console.error))
        this.bot.scrimsEvents.on('messageDelete', message => this.onMessageDelete(message).catch(console.error))

        this.bot.scrimsEvents.on('reactionRemove', reaction => this.onReactionUpdate(reaction).catch(console.error))
        this.bot.scrimsEvents.on('reactionAdd', reaction => this.onReactionUpdate(reaction).catch(console.error))

        this.bot.scrimsEvents.on('channelDelete', channel => this.onChannelDelete(channel).catch(console.error))

        await this.removeOldMessages().catch(console.error)
        setInterval(() => this.removeOldMessages().catch(console.error), 5*60*1000)

    }

    async logError(msg, context) {

        if (context.error) console.error(`${msg} Reason: ${context.error}`)
        this.database.ipc.notify('suggestions_error', { msg, ...context })

    }

    async logSuccess(msg, context) {

        this.database.ipc.notify(`suggestions_success`, { msg, ...context })

    }

    getVoteEmojis(guild) {

        return [["suggestion_up_vote_emoji", "????"], ["suggestion_down_vote_emoji", "????"]]
            .map(([key, def]) => guild.emojis.resolve(this.bot.getConfig(guild.id, key)) ?? def);

    }

    async onMessageCreate(message) { 

        const suggestionsChannel = this.suggestionChannels[message.guild.id]
        // Message was not created in the suggestions channel so we ignore it
        if (message.channel.id !== suggestionsChannel?.id) return false;

        // Messages like CHANNEL_PINNED_MESSAGE & THREAD_CREATED should get deleted
        const badMessageTypes = ['CHANNEL_PINNED_MESSAGE', 'THREAD_CREATED']
        if (badMessageTypes.includes(message.type)) return message.delete().catch(console.error);
    
        // This bot sent the message so don't worry about it
        if (message.author.id === this.bot.user.id) return false;
    
        // Recreate the suggestions info message so that it is displayed at the bottom of the channel
        await this.sendSuggestionInfoMessage(message.channel, false)
    
    }

    async onMessageDelete(message) {

        if (message.author?.id !== this.bot.user?.id) return false;
        const suggestion = this.database.suggestions.cache.find({ message_id: message.id })

        if (suggestion) {

            const rating = this.getMessageRating(message)
            await this.database.suggestions.remove({ message_id: message.id })
            this.database.ipc.send('audited_suggestion_remove', { suggestion, executor_id: message?.executor?.id, rating })

        }
        
    }

    /** @param {MessageReaction} reaction */
    async onReactionUpdate(reaction) {

        if (reaction.message.author !== this.bot.user) return false;
        if (reaction.userId === this.bot.user.id) return false;
        await onReactionUpdate(reaction).catch(console.error)
        
    }

    async sendSuggestionInfoMessage(channel, resend) {

        await this.infoMessageBuffer.run(channel, resend).catch(console.error)

    }
    
    async sendSuggestionInfoMessageTask(channel, resend) {

        const context = { guild_id: channel.guild.id, channel_name: channel.name }

        this.suggestionChannels[channel.guild.id] = channel;
        
        clearTimeout(this.suggestionInfoMessageReloads[channel.guild.id])

        await this.suggestionInfoMessages[channel.guild.id]?.delete()?.catch(() => null);
        const message = await channel.send(SuggestionsResponseMessageBuilder.suggestionsInfoMessage(channel.guild.name))
            .catch(error => this.logError(`Suggestions message could not be sent!`, { ...context, error }))

        this.suggestionInfoMessages[channel.guild.id] = message;
        if (resend) this.suggestionInfoMessageReloads[channel.guild.id] = setTimeout(() => this.sendSuggestionInfoMessage(channel, false).catch(console.error), 7*60*1000)

    }

}

module.exports = SuggestionsFeature;