
class ScrimsPositionUpdater {


    constructor(syncHostFeature) {

        this.sync = syncHostFeature

        this.bot.on("databaseConnected", () => this.startUp())

    }

    get bot() {

        return this.sync.bot;

    }

    get database() {

        return this.sync.bot.database;

    }

    get hostGuildId() {

        return this.sync.mainDiscordServer;

    }

    startUp() {

        this.bot.on('guildMemberUpdate', (oldMember, newMember) => this.onMemberUpdate(oldMember, newMember))
        
        this.bot.on('guildMemberRemove', member => this.onMemberRemove(member))
        this.bot.on('guildMemberAdd', member => this.onMemberAdd(member))

        this.bot.database.positionRoles.cache.on('push', positionRole => this.onPositionRoleChange(positionRole))
        this.bot.database.positionRoles.cache.on('update', positionRole => this.onPositionRoleChange(positionRole))
        this.bot.database.positionRoles.cache.on('remove', positionRole => this.onPositionRoleChange(positionRole))

    }

    async onPositionRoleChange(positionRole) {

        if (positionRole.guild_id == this.hostGuildId)
            return this.reloadPositionMembers(positionRole.id_position);

    }

    async reloadPositionMembers(id_position) {

        const members = await this.sync.fetchHostGuildMembers()
        if (!members) return false;

        await Promise.all(members.map(member => this.reloadMemberPosition(member, id_position)))

    }

    async reloadMemberPosition(member, id_position) {

        const hasPossition = this.bot.permissions.hasRequiredPosition(member, id_position)
        const shouldHavePossition = this.bot.permissions.hasRequiredPositionRoles(member, id_position)
        
        if (hasPossition && !shouldHavePossition)
            await this.database.userPositions.remove({ id_position, user: { discord_id: member.id } })
                .catch(error => console.error(`Unable to remove position ${id_position} from ${member?.tag} because of ${error}`, hasPossition, shouldHavePossition, id_position))

        if (shouldHavePossition && !hasPossition) {

            const userPosition = {

                user: { discord_id: member.id },
                id_position,
                given_at: Math.round( Date.now()/1000 ),
                executor: { discord_id: this.bot.user.id }

            }

            await this.database.userPositions.create( userPosition )
                .catch(error => console.error(`Unable to create user position because of ${error}!`, userPosition))

        }

    }

    async onMemberRemove(member) {

        if (member.guild.id == this.hostGuildId) await this.sync.scrimsMemberRemove(member.id)

    }

    async onMemberAdd(member) {

        if (member.guild.id != this.hostGuildId) return false;

        const user = await this.sync.fetchScrimsUser(member.id)

        // Make sure the user lost their non sticky positions when they left
        if (user) await this.sync.removeUnstickyPositions(member.id)

        // Add User to scrims user database
        if (user === null) await this.sync.addScrimsUser(member)

        // Give user member position
        await this.sync.addUserMemberPosition(member.id)

        // Give user any sticky roles they should have based off their positions
        await this.sync.addPositionRoles(member, true)

    }

    async onMemberUpdate(oldMember, newMember) {

        if (newMember.guild.id != this.hostGuildId) return false;

        if (oldMember.roles.cache.size != newMember.roles.cache.size) {

            if (oldMember.partial) return false; // Member not cached so initialization not finished
            if (newMember.partial) newMember = await newMember.fetch()

            const lostPositionRoles = this.getPositionRolesDifference(newMember.guild.id, oldMember.roles, newMember.roles)
            const newPositionRoles = this.getPositionRolesDifference(newMember.guild.id, newMember.roles, oldMember.roles)

            if (lostPositionRoles.length > 0) {
                await Promise.allSettled(lostPositionRoles.map(role => this.removeScrimsUserPosition(newMember, role))).then(this.logErrors)
            }
                
            if (newPositionRoles.length > 0) {
                const logEntry = await this.getRoleUpdateAuditLogEntry(newMember, lostPositionRoles.map(v => v.role_id), newPositionRoles.map(v => v.role_id)).catch(console.error)
                await Promise.allSettled(newPositionRoles.map(role => this.addScrimsUserPosition(newMember, role, logEntry))).then(this.logErrors)
            }
            
        }

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

    async addScrimsUserPosition(member, position, logEntry) {

        return this.sync.createScrimsPosition({ user: { discord_id: member.id }, id_position: position.id_position }, logEntry);

    }

    async removeScrimsUserPosition( member, position ) {

        const positionIdentifier = { user: { discord_id: member.id }, id_position: position.id_position }

        await this.database.userPositions.remove( positionIdentifier )
            .catch(error => console.error(`Unable to remove scrims user position for member ${member.user.tag} because of ${error}!`, positionIdentifier))

    }

    getRolesDifference(rolesA, rolesB) {
        return rolesA.cache.filter(roleA => rolesB.cache.filter(roleB => roleB.id === roleA.id).size === 0);
    }

    getPositionRoles(guildId, roles) {
        const positionRoles = this.bot.permissions.getGuildPositionRoles(guildId)
        return [ ...new Set(roles.map(role => positionRoles.filter(roleP => roleP.role_id == role.id)).flat()) ];
    }

    getPositionRolesDifference(guildId, rolesA, rolesB) {
        return this.getPositionRoles(guildId, this.getRolesDifference(rolesA, rolesB));
    }


}

module.exports = ScrimsPositionUpdater;