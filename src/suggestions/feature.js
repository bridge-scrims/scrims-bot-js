const SuggestionsResponseMessageBuilder = require("./responses");
const { SuggestionsTable } = require("./tables");
const onReactionUpdate = require("./reactions");

const { interactionHandler, commands } = require("./interactions");

class SuggestionsFeature {

    constructor(bot, config) {

        this.bot = bot
        this.config = config;
        
        Object.entries(config).forEach(([key, value]) => this[key] = value)

        commands.forEach(([ cmdData, cmdPerms ]) => this.bot.commands.add(cmdData, cmdPerms))

        // The message at the bottom of the suggestions channel
        this.suggestionsInfoMessage = null

        bot.on('ready', () => this.onReady())

    }

    async onReady() {

        this.bot.database.suggestions = new SuggestionsTable(this.bot.database)
        await this.bot.database.suggestions.connect()

        if (this.channelId) await this.initSuggestions()

        this.bot.on('scrimsMessageCreate', message => this.onMessageCreate(message))
        this.bot.on('scrimsMessageDelete', message => this.onMessageDelete(message))

        this.bot.on('scrimsReactionRemove', reaction => this.onReactionUpdate(reaction))
        this.bot.on('scrimsReactionAdd', reaction => this.onReactionUpdate(reaction))

        this.addEventHandlers()

    }

    getVoteEmojis(guild) {

        return [["upVoteEmoji", "👍"], ["downVoteEmoji", "👎"]].map(([key, def]) => guild.emojis.resolve(this[key]) ?? def);

    }

    async onMessageCreate(message) { 

        // Message was not created in the suggestions channel so we ignore it
        if (message.channel.id != this.channelId) return false;

        // Messages like CHANNEL_PINNED_MESSAGE & THREAD_CREATED should get deleted
        const badMessageTypes = ['CHANNEL_PINNED_MESSAGE', 'THREAD_STARTER_MESSAGE']
        if (badMessageTypes.includes(message.type)) return message.delete().catch(console.error);
    
        // This bot sent the message so don't worry about it
        if (message.author.id == this.bot.user.id) return false;
    
        // Recreate the suggestions info message so that it is displayed at the bottom of the channel
        await this.sendSuggestionInfoMessage(message.channel, false)
    
    }

    async onMessageDelete(message) {

        // If a suggestion message was delted it should also be deleted in the database
        await message.client.database.suggestions.remove({ message_id: message.id }).catch(console.error);

    }

    async onReactionUpdate(reaction) {

        if (reaction.userId == this.bot.user.id) return false;
        await onReactionUpdate(reaction).catch(console.error)
        
    }

    addEventHandlers() {

        this.bot.addEventHandler("suggestion", interactionHandler)

        commands.forEach(([ cmdData, _ ]) => this.bot.addEventHandler(cmdData.name, interactionHandler))
        
    }

    async initSuggestions() {

        const channel = await this.bot.channels.fetch(this.channelId)
        const messages = await channel.messages.fetch()
        await Promise.all(messages.filter(msg => (msg.components.length > 0)).map(msg => msg.delete()))
        await this.sendSuggestionInfoMessage(channel, true)

    }

    async sendSuggestionInfoMessage(channel, resend) {

        clearTimeout(this.suggestionsInfoMessageReload)

        await this.suggestionsInfoMessage?.delete()?.catch(() => null);
        this.suggestionsInfoMessage = await channel.send(SuggestionsResponseMessageBuilder.suggestionsInfoMessage(channel.guild.name))

        if (resend) this.suggestionsInfoMessageReload = setTimeout(() => this.sendSuggestionInfoMessage(channel, false)?.catch(console.error), 7*60*1000)

    }

}

module.exports = SuggestionsFeature;