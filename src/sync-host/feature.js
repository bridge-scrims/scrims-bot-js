const ScrimsPositionUpdater = require("./updater");

const { interactionHandler, commands, eventListeners } = require("./commands");


class ScrimsSyncHostFeature {

    constructor(bot, config) {

        this.bot = bot
        this.config = config
        
        Object.entries(config).forEach(([key, value]) => this[key] = value)

        commands.forEach(([ cmdData, cmdPerms ]) => this.bot.commands.add(cmdData, cmdPerms))
        
        this.positionUpdater = new ScrimsPositionUpdater(this)

        bot.on('ready', () => this.addEventHandlers())
        bot.on('databaseConnected', () => this.startUp())

    }

    get permissions() {

        return this.bot.permissions;

    }

    async startUp() {

        this.bot.on('userUpdate', (oldUser, newUser) => this.onUserUpdate(oldUser, newUser))
        
        const guild = await this.fetchHostGuild()

        // First add the bot as a scrims user so that it can be an executor
        const botMember = await guild.members.fetch(this.bot.user.id)
        await this.initializeMember(botMember)

        const members = await this.fetchHostGuildMembers()
        if (guild && members) await this.initializeMembers(guild, members)

    }

    addEventHandlers() {

        commands.forEach(([ cmdData, _ ]) => this.bot.addEventHandler(cmdData.name, interactionHandler))
        eventListeners.forEach(eventName => this.bot.addEventHandler(eventName, interactionHandler))
        
    }

    async fetchHostGuild() {

        return this.bot.guilds.fetch(this.mainDiscordServer).then(guild => guild?.fetch())
            .catch(error => console.error(`Unable to fetch main discord server!`, error))

    }

    async fetchHostGuildMembers() {

        const guild = await this.fetchHostGuild()
        if (guild) {

            return guild.members.fetch()
                .catch(error => console.error(`Unable to fetch members of mein discord server!`, error))

        }

        return null;

    }

    getMemberMissingPositions(member) {

        const positions = this.bot.database.userPositions.cache.get({ user: { discord_id: member.id } })
        
        const allPositionRoles = this.permissions.getGuildPositionRoles(member.guild.id)
        const allowedPositionRoles = allPositionRoles.filter(pRole => this.permissions.hasRequiredPositionRoles(member, pRole.id_position))
        const missingPositionRoles = allowedPositionRoles.filter(pRoleA => positions.filter(pRoleB => pRoleA.id_position == pRoleB.id_position).length === 0)
        
        return missingPositionRoles;

    }

    getMemberUnallowedPositions(member) {

        const userPositions = this.bot.database.userPositions.cache.get({ user: { discord_id: member.id } })
        return userPositions.filter(userPos => !this.memberIsAllowedPosition(member, userPos.position))

    }

    memberIsAllowedPosition(member, position) {

        const requiredRoles = this.permissions.getPositionRequiredRoles(member.guild.id, position.id_position)
        return (requiredRoles.every(roleId => member.roles.cache.has(roleId)));

    }

    async fetchUserPositions(memberId) {

        return this.bot.database.userPositions.get({ user: { discord_id: memberId } })
            .catch(error => console.error(`Unable to get scrims user positions with discord id ${memberId} because of ${error}!`, error))

    }

    async fetchScrimsUser(memberId) {

        return this.bot.database.users.get({ discord_id: memberId }).then(users => users[0] ?? null)
            .catch(error => console.error(`Unable to get scrims user with discord id ${memberId} because of ${error}!`))

    }

    async addUserMemberPosition(memberId) {

        return this.createScrimsPosition({ position: { name: "bridge_scrims_member" }, user: { discord_id: memberId } }, null)

    }

    async createScrimsPosition(selector, auditEntry) {

        const existing = this.bot.database.userPositions.cache.get(selector)
        if (existing.length > 0) return true;

        const userPositionData = {
            given_at: Math.round((auditEntry?.createdTimestamp || Date.now())/1000), 
            executor: { discord_id: (auditEntry?.executor?.id || this.bot.user.id) },
            ...selector
        }

        await this.bot.database.userPositions.create( userPositionData ) 
            .catch(error => console.error(`Unable to create scrims user position because of ${error}!`, userPositionData))

    }

    async addScrimsUser(member) {

        const scrimsUser = { 
            discord_id: member.id, discord_tag: member.user.tag, joined_at: Math.round(member.joinedTimestamp/1000)
        }

        await this.bot.database.users.create( scrimsUser )
            .catch(error => console.error(`Unable to create scrims user for member ${member.user.tag} because of ${error}!`, scrimsUser))

        await this.addUserMemberPosition(member.id)

    }

    async onUserUpdate(oldUser, newUser) {

        if (oldUser.tag != newUser.tag) {
            await this.updateScrimsUserTag(newUser.id, oldUser.tag, newUser.tag)
        }

    }

    async updateScrimsUserTag(discordId, oldTag, discordTag) {

        await this.bot.database.users.update({ discord_tag: discordTag }, { discord_id: discordId })
            .catch(error => console.error(`Unable to apply change (${oldTag} -> ${discordTag}) to scrims user with discord id ${discordId}!`, error))

    }

    async addPositionRoles(member, onlySticky) {

        const stickySelector = (onlySticky ? { position: { sticky: true } } : {})
        const userPositions = await this.bot.database.userPositions.get({ user: { discord_id: member.id }, ...stickySelector })
        const discordRoleIds = userPositions.map(p => this.permissions.getPositionRequiredRoles(member.guild.id, p.id_position)).flat()
        const missingRoleIds = discordRoleIds.filter(roleId => !member.roles.cache.has(roleId))
        
        if (missingRoleIds.length > 0 ) {
            await member.roles.add([ ...new Set(missingRoleIds) ])
                .catch(error => console.error(`Unable to add position roles to ${member.user.tag}!`, userPositions, missingRoleIds, error))
        }
        
    }

    async removeUnstickyPositions(memberId) {

        await this.bot.database.userPositions.remove({ user: { discord_id: memberId }, position: { sticky: 0 } })
            .catch(error => console.error(`Unable to remove non sticky positions of user with discord id ${memberId}!`, error))

    }

    async scrimsMemberRemove(memberId) {

        // Remove all non sticky positions
        await this.removeUnstickyPositions(memberId)

    }

    async initializeMembers(guild, members) {

        await Promise.all(members.map(member => this.initializeMember(member)))

        const ghostUsers = this.bot.database.users.cache.get({ }).filter(scrimsUser => !guild.members.cache.has(scrimsUser.discord_id))
        await Promise.all(ghostUsers.map(ghost => this.scrimsMemberRemove(ghost.discord_id)))

        console.log("Members initialized!")

    }

    async getMembersPositionsDifference(guild) {

        const members = await guild.members.fetch()
        return members.map(member => [ this.getMemberMissingPositions(member), this.getMemberUnallowedPositions(member) ]);

    }

    async transferPositions(guild) {

        const members = await guild.members.fetch()
        await Promise.all(members.map(member => this.transferPositionsForMember(member)))

    }

    async transferPositionsForMember(member) {

        const remove = this.getMemberUnallowedPositions(member)
        const removeResults = await Promise.all(
            remove.map(userPos => this.bot.database.userPositions.remove({ id_user: userPos.id_user, id_position: userPos.id_position }).then(() => true)
                .catch(error => console.error(`Unable to remove user position because of ${error}!`, userPos))
            )
        )

        if (!removeResults.every(v => v === true)) throw new Error(`TransferPositionsForMember failed.`) 

        const create = this.getMemberMissingPositions(member)
            .map(posRole => ({ user: { discord_id: member.id }, id_position: posRole.id_position, given_at: Math.round(Date.now()/1000), executor: { discord_id: this.bot.user.id } }))
        
        const createResults = await Promise.all(
            create.map(userPos => this.bot.database.userPositions.create( userPos ).then(() => true)
                .catch(error => console.error(`Unable to create user position because of ${error}!`, userPos))
            )
        )

        if (!createResults.every(v => v === true)) throw new Error(`TransferPositionsForMember failed.`) 

    }

    async initializeMember(member) {

        const user = await this.fetchScrimsUser(member.id)
        if (user === null) await this.addScrimsUser(member)

        if (user && (user.discord_tag != member.user.tag))
            await this.updateScrimsUserTag(member.id, user.discord_tag, member.user.tag)

        const positions = await this.fetchUserPositions(member.id)
        
        if (positions && positions.filter(position => position.position_name == "bridge_scrims_member").length === 0)
            await this.addUserMemberPosition(member.id)

    }


}

module.exports = ScrimsSyncHostFeature;