const { OAuth2Guild, Guild, User, PartialUser, GuildMember, Collection, InviteGuild } = require("discord.js")
const ScrimsUser = require("../scrims/user")

class ScrimsUserUpdater {

    constructor(bot) {

        Object.defineProperty(this, 'bot', { value: bot })
        
        /**
         * @type {import("../../bot")}
         * @readonly
         */
        this.bot

        this.bot.on('ready', () => this.addEventListeners())

    }

    addEventListeners() {

        this.bot.on('guildMemberAdd', member => this.onMemberAdd(member).catch(console.error))
        this.bot.on('userUpdate', (_, newUser) => this.update(newUser).catch(console.error))

        this.bot.on('guildCreate', guild => this.initializeGuildMembers(guild).catch(console.error))

    }

    expandMember(member, scrimsUser) {
        return this.bot.expandMember(member, scrimsUser);
    }
    
    /**
     * @param {User} user 
     * @param {ScrimsUser} [scrimsUser]
     */
    async update(user, scrimsUser) {

        if (!scrimsUser) scrimsUser = this.bot.database.users.cache.find({ discord_id: user.id })
        if (!scrimsUser) return false;

        await user.fetch(true)
        if (scrimsUser.tag !== user.tag || scrimsUser.discord_avatar !== user.avatar || scrimsUser.discord_accent_color !== user.accentColor) {
            await this.updateScrimsUser(user.id, {

                discord_username: user.username, 
                discord_discriminator: user.discriminator,
                discord_accent_color: user.accentColor,
                discord_avatar: user.avatar

            })
        }

    }

    /** @param {GuildMember} member */
    async onMemberAdd(member) {

        const scrimsUsers = this.bot.database.users.cache.getMap("discord_id")
        await this.createMember(member, scrimsUsers[member.id])
        
        if (!member.scrimsUser) return false;
        this.bot.scrimsEvents.emit('guildMemberAdd', member)

    }

    /** 
     * @param { OAuth2Guild | Guild } guild 
     */
    async initializeGuildMembers(guild) {

        if (guild instanceof OAuth2Guild) guild = await guild.fetch()

        const members = await guild.members.fetch()
        const bans = await guild.bans.fetch().then(bans => bans.filter(v => v.user))
        const scrimsUsers = await this.bot.database.users.getMap({}, ["discord_id"], false)
        await Promise.all(members.map(member => this.createMember(member, scrimsUsers[member.id]))).catch(console.error)
        await Promise.all(bans.map(ban => this.createUser(ban.user, scrimsUsers[ban.user.id]))).catch(console.error)

        const allScrimsUsers = await this.bot.database.users.getMap({}, ["discord_id"], false)
        this.updateMembers(members, allScrimsUsers).catch(console.error)

    }

    /**
     * @param { Collection<string, GuildMember> } members
     * @param { Object.<string, ScrimsUser } allScrimsUsers 
     */
    async updateMembers(members, allScrimsUsers) {

        for (const member of members.values()) 
            await this.update(member.user, allScrimsUsers[member.id]).catch(console.error)

    }

    /**
     * @param { GuildMember } member
     * @param { ScrimsUser } scrimsUser
     */
    async createMember(member, scrimsUser) {

        if (!scrimsUser) return this.createScrimsUser(member);
        this.expandMember(member, scrimsUser)
        return scrimsUser;

    }

    async createUser(user, scrimsUser) {

        if (!scrimsUser) return this.createScrimsUser(user);
        this.bot.expandUser(user, scrimsUser)

    }

    /**
     * @param {GuildMember|User} discord 
     */
    async createScrimsUser(discord) {

        const user = discord?.user ?? discord
        await user.fetch()

        const scrimsUser = new ScrimsUser(this.bot.database).setDiscord(user)
        if (discord instanceof GuildMember && discord.guild.id === "759894401957888031") {
            scrimsUser.setDiscordAvatar(discord.avatar)
            scrimsUser.setJoinPoint(Math.floor(discord.joinedTimestamp/1000) )
        }

        return this.bot.database.users.create(scrimsUser).then(scrimsUser => this.expandMember(member, scrimsUser))
            .catch(error => console.error(`Unable to make scrims user for ${member.id} because of ${error}!`))

    }

    /**
     * @param {string} discordId 
     * @param {Object.<string, any>} changes
     */
    async updateScrimsUser(discordId, changes) {

        await this.bot.database.users.update({ discord_id: discordId }, changes)
            .catch(error => console.error(`Unable to apply changes to scrims user with discord id ${discordId} because of ${error}!`, changes))

    }

}

module.exports = ScrimsUserUpdater;