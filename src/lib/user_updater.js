const { OAuth2Guild, Guild, User, PartialUser, GuildMember, Collection } = require("discord.js")
const ScrimsUser = require("./scrims/user")

class ScrimsUserUpdater {

    constructor(bot) {

        Object.defineProperty(this, 'bot', { value: bot })
        
        /**
         * @type { import("./bot") }
         * @readonly
         */
        this.bot

        this.addEventListeners()

    }

    addEventListeners() {

        this.bot.on('guildMemberAdd', member => this.onMemberAdd(member))
        this.bot.on('userUpdate', (oldUser, newUser) => this.onUserUpdate(oldUser, newUser))

        this.bot.on('guildCreate', guild => this.initializeGuildMembers(guild))

    }

    /**
     * @param { User | PartialUser } oldUser 
     * @param { User } newUser 
     */
    async onUserUpdate(oldUser, newUser) {

        if (oldUser?.tag != newUser.tag || oldUser?.avatar != newUser.avatar || oldUser?.accentColor != newUser.accentColor) {
            await this.updateScrimsUser(newUser.id, {

                discord_username: newUser.username, 
                discord_discriminator: newUser.discriminator,
                discord_accent_color: newUser.accentColor,
                discord_avatar: newUser.avatar

            })
        }

    }

    /** 
     * @param { GuildMember } member 
     */
    async onMemberAdd(member) {

        const scrimsUsers = this.bot.database.users.cache.getMap("discord_id")
        member.scrimsUser = await this.createMember(member, scrimsUsers[member.id])
        this.bot.emit('scrimsGuildMemberAdd', member)

    }

    /** 
     * @param { OAuth2Guild | Guild } guild 
     */
    async initializeGuildMembers(guild) {

        if (guild instanceof OAuth2Guild) guild = await guild.fetch()

        const members = await guild.members.fetch()
        const scrimsUsers = await this.bot.database.users.getMap({}, ["discord_id"], false)
        await Promise.all(members.map(member => this.createMember(member, scrimsUsers[member.id]))).catch(console.error)

        const allScrimsUsers = await this.bot.database.users.getMap({}, ["discord_id"], false)
        this.updateMembers(members, allScrimsUsers).catch(console.error)

    }

    /**
     * @param { Collection<string, GuildMember> } members
     * @param { Object.<string, ScrimsUser } allScrimsUsers 
     */
    async updateMembers(members, allScrimsUsers) {

        for (const member of members.values()) 
            await this.updateMember(member, allScrimsUsers).catch(console.error)

    }

    /**
     * @param { GuildMember } member
     * @param { ScrimsUser } scrimsUser
     */
     async createMember(member, scrimsUser) {

        if (!scrimsUser) {

            await member.user.fetch()
            return this.createScrimsUser(member);

        }

        return scrimsUser;

    }

    /**
     * @param { GuildMember } member
     * @param { Object.<string, ScrimsUser> } scrimsUsers
     */
    async updateMember(member, scrimsUsers) {

        const scrimsUser = scrimsUsers[member.id]
        if (!scrimsUser) return false

        await member.user.fetch()
        
        if ((
                scrimsUser.discord_username != member.user.username 
                || scrimsUser.discord_discriminator != member.user.discriminator 
                || scrimsUser.discord_accent_color != member.user.accentColor 
                || scrimsUser.discord_avatar != member.user.avatar
            )
        ) await this.updateScrimsUser(member.id, {

            discord_username: member.user.username, 
            discord_discriminator: member.user.discriminator,
            discord_accent_color: member.user.accentColor,
            discord_avatar: member.user.avatar

        })

        return scrimsUser;

    }

    /**
     * @param { GuildMember } member 
     */
    async createScrimsUser(member) {

        return this.bot.database.users.create({ 

            id_user: this.bot.database.generateUUID(),
            discord_id: member.id, 
            discord_username: member.user.username, 
            discord_discriminator: member.user.discriminator,
            discord_accent_color: member.user.accentColor,
            discord_avatar: member.user.avatar, 
            joined_at: Math.round(member.joinedTimestamp/1000) 
            
        }).catch(error => console.error(`Unable to make scrims user for ${member.id} because of ${error}!`))

    }

    /**
     * @param { String } discordId 
     * @param { Object.<string, any> } changes
     */
    async updateScrimsUser(discordId, changes) {

        await this.bot.database.users.update({ discord_id: discordId }, changes)
            .catch(error => console.error(`Unable to apply changes to scrims user with discord id ${discordId} because of ${error}!`, changes))

    }

}

module.exports = ScrimsUserUpdater;