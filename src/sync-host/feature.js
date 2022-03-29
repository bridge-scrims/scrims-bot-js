
class ScrimsSyncHostFeature {

    constructor(bot, config) {

        this.bot = bot
        this.config = config
        
        Object.entries(config).forEach(([key, value]) => this[key] = value)

        bot.on('ready', () => this.onReady())
        
    }

    get permissions() {

        return this.bot.permissions;

    }

    async onReady() {

        this.bot.on('userUpdate', (oldUser, newUser) => this.onUserUpdate(oldUser, newUser))
        this.bot.on('guildMemberUpdate', (oldMember, newMember) => this.onMemberUpdate(oldMember, newMember))
        
        this.bot.on('guildMemberRemove', member => this.onMemberRemove(member))
        this.bot.on('guildMemberAdd', member => this.onMemberAdd(member))

        this.bot.on('guildCreate', guild => this.onGuildJoined(guild))

        const guild = await this.bot.guilds.fetch(this.mainDiscordServer).then(guild => guild?.fetch())
        if (guild) await this.initializeMembers(guild)

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

    logErrors(results) {

        results.filter(result => result.status === "rejected").forEach(result => console.error(result.reason))

    }

    async onMemberUpdate(oldMember, newMember) {

        if (newMember.guild.id != this.mainDiscordServer) return false;

        if (oldMember.roles.cache.size != newMember.roles.cache.size) {

            if (oldMember.partial) return false; // Member not cached so initialization not finished
            if (newMember.partial) newMember = await newMember.fetch()

            const lostPositionRoles = this.getPositionRolesDifference(newMember.guild.id, oldMember.roles, newMember.roles)
            const newPositionRoles = this.getPositionRolesDifference(newMember.guild.id, newMember.roles, oldMember.roles)

            if (lostPositionRoles.length > 0) {
                await Promise.allSettled(lostPositionRoles.map(role => this.removeScrimsUserPosition(newMember, role))).then(this.logErrors)
            }
                
            if (newPositionRoles.length > 0) {
                const logEntry = await this.getRoleUpdateAuditLogEntry(newMember, lostPositionRoles.map(v => v.id_role), newPositionRoles.map(v => v.id_role)).catch(console.error)
                await Promise.allSettled(newPositionRoles.map(role => this.addScrimsUserPosition(newMember, role, logEntry))).then(this.logErrors)
            }
            
        }

    }

    async onMemberRemove(member) {

        if (member.guild.id == this.mainDiscordServer) await this.scrimsMemberRemove(member.id)

    }

    async onMemberAdd(member) {

        if (member.guild.id != this.mainDiscordServer) return false;

        const user = await this.fetchScrimsUser(member.id)

        // Make sure the user lost their non sticky positions when they left
        if (user) await this.removeUnstickyPositions(member.id)

        // Add User to scrims user database
        if (!user) await this.addScrimsUser(member)

        // Give user member position
        await this.addUserMemberPosition(member.id)

        // Give user any sticky roles they should have based off their positions
        await this.addPositionRoles(member, true)

    }

    async onGuildJoined(guild) {

        if (guild.id == this.mainDiscordServer) return this.initializeMembers(guild);

    }

    async removeUnstickyPositions(memberId) {

        await this.bot.database.userPositions.remove({ user: { discord_id: memberId }, position: { sticky: 0 } })
            .catch(error => console.error(`Unable to remove non sticky positions of user with discord id ${memberId}!`, error))

    }

    async scrimsMemberRemove(memberId) {

        // Remove all non sticky positions
        await this.removeUnstickyPositions(memberId)

    }

    async initializeMembers(guild) {

        // First add the bot as a scrims user so that it can be an executor
        await this.initializeMember(await guild.members.fetch(this.bot.user.id))

        const members = await guild.members.fetch()
            .catch(error => console.error(`Unable to fetch main guild member for initialization!`, error))

        await Promise.allSettled(members.map(member => this.initializeMember(member))).then(this.logErrors)

        const memberPositionUsers = await this.bot.database.userPositions.get({ position: { name: "bridge_scrims_member" } })  
            .catch(error => console.error(`Unable to fetch the users that have the bridge_scrims_member position!`, error))
        
        const ghostUsers = this.bot.database.users.cache.filter(scrimsUser => !guild.members.cache.has(scrimsUser.discord_id))
        await Promise.allSettled(ghostUsers.map(ghost => this.scrimsMemberRemove(ghost.discord_id))).then(this.logErrors)

        console.log("Members initialized!")

    }

    async initializeMember(member) {

        const user = await this.fetchScrimsUser(member.id)
        if (!user) await this.addScrimsUser(member)

        if (user && (user.discord_tag != member.user.tag))
            await this.updateScrimsUserTag(member.id, user.discord_tag, member.user.tag)

        const positions = await this.fetchUserPositions(member.id)
        
        if (positions.filter(position => position.position_name == "bridge_scrims_member").length === 0)
            await this.addUserMemberPosition(member.id)

        // Removing all position roles the user should not have
        if (positions) await Promise.allSettled(positions.map(position => this.verifyScrimsMemberPosition(member, position))).then(this.logErrors)

        // Adding all position roles the user should have
        const allPositionRoles = this.permissions.getGuildPositionRoles(member.guild.id)
        const allowedPositionRoles = allPositionRoles.filter(pRole => this.permissions.hasRequiredPositionRoles(member, pRole.id_position))
        const missingPositionRoles = allowedPositionRoles.filter(pRoleA => positions.filter(pRoleB => pRoleA.id_position == pRoleB.id_position).length === 0)
        await Promise.allSettled(missingPositionRoles.map(pRole => this.addScrimsUserPosition(member, pRole, null))).then(this.logErrors)

    }

    async addPositionRoles(member, onlySticky) {

        const stickySelector = (onlySticky ? { position: { sticky: true } } : {})
        const userPositions = this.bot.database.userPositions.cache.get({ user: { discord_id: member.id }, ...stickySelector })
        const discordRoleIds = userPositions.map(p => this.permissions.getPositionRequiredRoles(member.guild.id, p.id_position)).flat()
        const missingRoleIds = discordRoleIds.filter(roleId => !member.roles.cache.has(roleId))
        
        if (missingRoleIds.length > 0 ) {
            await member.roles.add([ ...new Set(missingRoleIds) ])
                .catch(error => console.error(`Unable to add position roles to ${member.user.tag}!`, userPositions, missingRoleIds, error))
        }
        
    }

    async verifyScrimsMemberPosition(member, position) {

        const requiredRoles = this.permissions.getPositionRequiredRoles(member.guild.id, position.id_position)
        if (requiredRoles.every(roleId => member.roles.cache.has(roleId))) return true; //All good

        await this.removeScrimsUserPosition(member, position)

    }

    async fetchUserPositions(memberId) {

        return this.bot.database.userPositions.get({ user: { discord_id: memberId } })
            .catch(error => console.error(`Unable to get scrims user positions with discord id ${memberId} because of ${error}!`, error))

    }

    async fetchScrimsUser(memberId) {

        return this.bot.database.users.get({ discord_id: memberId }).then(users => users[0] ?? null)
            .catch(error => console.error(`Unable to get scrims user with discord id ${memberId} because of ${error}!`))

    }

    async createScrimsPosition(selector, auditEntry) {

        const existing = this.bot.database.userPositions.cache.get(selector)
        if (existing.length > 0) return true;

        const userPositionData = {
            given_at: Math.round((auditEntry?.createdTimestamp || Date.now())/1000), 
            executor: { discord_id: (auditEntry?.executor?.id || this.bot.user.id) },
            ...selector
        }

        await this.bot.database.userPositions.create({ ...userPositionData }) 
            .catch(error => console.error(`Unable to create scrims user position because of ${error}!`, userPositionData))

    }

    async addUserMemberPosition(memberId) {

        return this.createScrimsPosition({ position: { name: "bridge_scrims_member" }, user: { discord_id: memberId } }, null)

    }

    async addScrimsUser(member) {

        const scrimsUser = { 
            discord_id: member.id, discord_tag: member.user.tag, joined_at: Math.round(member.joinedTimestamp/1000)
        }

        await this.bot.database.users.create({ ...scrimsUser })
            .catch(error => console.error(`Unable to create scrims user for member ${member.user.tag} because of ${error}!`, scrimsUser))

        await this.addUserMemberPosition(member.id)

    }

    async addScrimsUserPosition(member, position, logEntry) {

        return this.createScrimsPosition({ user: { discord_id: member.id }, id_position: position.id_position }, logEntry);

    }

    async removeScrimsUserPosition(member, position) {

        const positionIdentifier = { user: { discord_id: member.id }, id_position: position.id_position }

        await this.bot.database.userPositions.remove({ ...positionIdentifier })
            .catch(error => console.error(`Unable to remove scrims user position for member ${member.user.tag} because of ${error}!`, positionIdentifier))

    }

    async getRoleUpdateAuditLogEntry(member, lostRoles, newRoles) {

        const fetchedLogs = await member.guild.fetchAuditLogs({ limit: 1, type: 'MEMBER_ROLE_UPDATE' })
            .catch(error => console.error(`Failed to fetch newest MEMBER_ROLE_UPDATE audit log entry!`, error))

        const roleUpdateLog = fetchedLogs.entries.first()

        if (!roleUpdateLog) return null;
        if (roleUpdateLog.target.id !== member.id) return null;

        if (roleUpdateLog.changes.length !== (lostRoles.length + newRoles.length)) return null;
        if (!lostRoles.every(roleId => this.logEntryChangesContains(roleUpdateLog.changes, '$remove', roleId))) return null;
        if (!newRoles.every(roleId => this.logEntryChangesContains(roleUpdateLog.changes, '$add', roleId))) return null;
        
        return roleUpdateLog;

    }

    logEntryChangesContains(changes, key, identifier) {
        return changes.filter(change => change.key === key && (change.new.filter(n => n.id == identifier).length > 0)).length > 0;
    }

    getRolesDifference(rolesA, rolesB) {
        return rolesA.cache.filter(roleA => rolesB.cache.filter(roleB => roleB.id === roleA.id).size === 0);
    }

    getPositionRoles(guildId, roles) {
        const positionRoles = this.permissions.getGuildPositionRoles(guildId)
        return [ ...new Set(roles.map(role => positionRoles.filter(roleP => roleP.id_role == role.id)).flat()) ];
    }

    getPositionRolesDifference(guildId, rolesA, rolesB) {
        return this.getPositionRoles(guildId, this.getRolesDifference(rolesA, rolesB));
    }


}

module.exports = ScrimsSyncHostFeature;