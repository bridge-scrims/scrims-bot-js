const EventEmitter = require("events");

class ScrimsBotEventEmitter extends EventEmitter {

    constructor(bot) {

        super();

        /** @type {import("./bot")} */
        this.bot = bot
        this.__addListeners()

    }

    __addListeners() {

        this.bot.on("guildBanAdd", ban => this.onBanAdd(ban).catch(console.error))
        this.bot.on("guildBanRemove", ban => this.onBanRemove(ban).catch(console.error))
        this.bot.on("messageDelete", message => this.onMessageDelete(message).catch(console.error))
        this.bot.on("channelDelete", channel => this.onChannelDelete(channel).catch(console.error))
        this.bot.on("channelCreate", channel => this.onChannelCreate(channel).catch(console.error))
        this.bot.on("guildMemberUpdate", (oldMember, newMember) => this.onMemberUpdate(oldMember, newMember).catch(console.error))

        this.bot.on('messageCreate', message => this.onMessage(message).catch(console.error))
        this.bot.on('messageReactionAdd', (reaction, user) => this.onReaction(reaction, user, "reactionAdd").catch(console.error))
        this.bot.on('messageReactionRemove', (reaction, user) => this.onReaction(reaction, user, "reactionRemove").catch(console.error))

    }

    async onMessage(message) {

        if (!message.author) return false;
        message.user = message.author

        if (!message.user.scrimsUser) this.bot.expandUser(message.user)
        if (!message.user.scrimsUser) return false;

        message.scrimsUser = message.user.scrimsUser
        message.id_user = message.user.scrimsUser.id_user

        this.emit("messageCreate", message)

    }

    async onReaction(reaction, user, event) {

        if (!user.scrimsUser) this.bot.expandUser(user)
        if (!user.scrimsUser) return false;

        reaction.user = user
        reaction.scrimsUser = user.scrimsUser
        reaction.id_user = user.scrimsUser.id_user

        this.emit(event, reaction)

    }

    async findExecutor(object, type, validater) {
        if (object.guild) {
    
            const fetchedLogs = await object.guild.fetchAuditLogs({ limit: 3, type })
                .catch(error => console.error(`Unable to fetch audit logs because of ${error}!`))
    
            if (fetchedLogs) {
                const log = fetchedLogs.entries.filter(log => validater(object, log)).first()
                if (log) {
                    
                    object.executor = log.executor;
                    if (object.executor && !object.executor.scrimsUser) this.bot.expandUser(object.executor)
        
                }
            }
            
        }
    }

    async onMemberUpdate(oldMember, newMember) {

        if (!newMember.scrimsUser) newMember.client.expandMember(newMember)
        if (!newMember.scrimsUser) return false;
        
        if (oldMember.roles.cache.size !== newMember.roles.cache.size) {

            const validater = (member, log) => (member.id === log.target.id);
            await this.findExecutor(newMember, "MEMBER_ROLE_UPDATE", validater)
            this.emit("memberRolesUpdate", oldMember, newMember)

        }

    }

    async onBanAdd(ban) {

        const validater = (ban, log) => (ban?.user?.id === log.target.id);
        await this.findExecutor(ban, "MEMBER_BAN_ADD", validater)
        this.emit("banAdd", ban)
    
    }
    
    async onBanRemove(ban) {
    
        const validater = (ban, log) => (ban?.user?.id === log.target.id);
        await this.findExecutor(ban, "MEMBER_BAN_REMOVE", validater)
        this.emit("banRemove", ban)
    
    }
    
    async onMessageDelete(message) {
    
        const validater = (message, log) => ((message.partial || log.target.id == message.author.id) && (log.extra.channel.id == message.channelId))
        await this.findExecutor(message, "MESSAGE_DELETE", validater)
        this.emit("messageDelete", message)

    }
    
    async onChannelDelete(channel) {
    
        const validater = (channel, log) => (channel.id === log.target.id);
        await this.findExecutor(channel, "CHANNEL_DELETE", validater)
        this.emit("channelDelete", channel)
    
    }
    
    async onChannelCreate(channel) {
    
        const validater = (channel, log) => (channel.id === log.target.id);
        await this.findExecutor(channel, "CHANNEL_CREATE", validater)
        this.emit("channelCreate", channel)

    }

}

module.exports = ScrimsBotEventEmitter;