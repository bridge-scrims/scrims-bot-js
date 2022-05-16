
class ScrimsPositionUpdater {


    constructor(syncHostFeature) {

        /**
         * @type { import('./feature') }
         */
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

        return this.sync.hostGuildId;

    }

    startUp() {

        this.bot.on('scrimsMemberUpdate', ({ oldMember, newMember, executor }) => this.onMemberUpdate(oldMember, newMember, executor))
        
        this.bot.on('guildMemberRemove', member => this.onMemberRemove(member))
        this.bot.on('scrimsGuildMemberAdd', member => this.onMemberAdd(member))

        this.database.positionRoles.cache.on('change', positionRole => this.onPositionRoleChange(positionRole))

    }

    async onPositionRoleChange(positionRole) {

        if (positionRole.guild_id === this.hostGuildId) {

            return this.reloadPositionMembers(positionRole.id_position);

        }
            
    }

    async reloadPositionMembers(id_position) {

        const members = await this.sync.fetchHostGuildMembers()
        if (!members) return false;

        const position = await this.database.positions.get({ id_position }).then(results => results[0] ?? null)
            .catch(error => console.error(`Unable to fetch scrims position because of ${error}!`, id_position))

        if (!position || position.name === "bridge_scrims_member") return false;

        const scrimsUsers = await this.database.users.getMap({}, ['discord_id'])
            .catch(error => console.error(`Unable to fetch scrims users because of ${error}!`, id_position))
          
        const userPositions = await this.bot.database.userPositions.getArrayMap({}, ['user', 'discord_id'])
            .catch(error => console.error(`Unable to fetch scrims user positions because of ${error}!`, id_position))

        if (scrimsUsers && userPositions) 
            await Promise.all(members.map(member => this.reloadMemberPosition(member, scrimsUsers[member.id]?.id_user, id_position, userPositions[member.id])))

    }

    async reloadMemberPosition(member, id_user, id_position, userPositions=[]) {

        if (!id_user) return false;

        const userPosition = userPositions.filter(userPos => userPos.id_user === id_user && userPos.id_position === id_position)[0]
        const shouldHavePossition = this.bot.permissions.hasRequiredPositionRoles(member, id_position)
        
        if (userPosition && !shouldHavePossition) {

            const success = await this.database.userPositions.remove({ id_position, id_user }).then(() => true)
                .catch(error => console.error(`Unable to remove position ${id_position} from ${member?.tag} because of ${error}!`, hasPossition, shouldHavePossition, id_position))

            if (success === true) this.bot.database.ipc.notify("audited_user_position_remove", { executor_id: this.bot.user.id, userPosition })

        }
            
        if (shouldHavePossition && !userPosition) {

            const userPosition = {

                id_user,
                id_position,
                given_at: Math.round( Date.now()/1000 ),
                executor: { discord_id: this.bot.user.id }

            }

            await this.database.userPositions.create(userPosition)
                .catch(error => console.error(`Unable to create user position because of ${error}!`, userPosition))

        }

    }

    async onMemberRemove(member) {

        if (member.guild.id === this.hostGuildId) {
            
            const id_user = await this.database.users.get({ discord_id: member.id }).then(users => users[0]?.id_user)
            if (id_user) {

                const userPositions = await this.bot.database.userPositions.get({ id_user }, false)
                await this.sync.scrimsMemberRemove(id_user, userPositions)
                
            }

        }

    }

    async onMemberAdd(member) {

        if (member.guild.id === this.hostGuildId) {

            // Make sure the user lost their non sticky positions when they left
            if (member.scrimsUser) await this.sync.removeUnstickyPositions(member.id)

            // Give user member position
            await this.sync.addUserMemberPosition(member.id)

        }

    }

    async onMemberUpdate(oldMember, newMember, executor) {

        if (newMember.guild.id !== this.hostGuildId) return false;

        if (oldMember.roles.cache.size !== newMember.roles.cache.size) {

            const id_user = await this.database.users.get({ discord_id: newMember.id }).then(users => users[0]?.id_user)
            if (!id_user) return false; // User has not been added to the bridge scrims database

            if (oldMember.partial) return false; // Member not cached so we can not find out the roles difference
            if (newMember.partial) newMember = await newMember.fetch()

            const lostPositionRoles = this.getPositionRolesDifference(newMember.guild.id, oldMember.roles, newMember.roles)
            const newPositionRoles = this.getPositionRolesDifference(newMember.guild.id, newMember.roles, oldMember.roles)

            if (lostPositionRoles.length > 0) await Promise.allSettled(lostPositionRoles.map(role => this.removeScrimsUserPosition(id_user, newMember, role, executor)))
            if (newPositionRoles.length > 0) await Promise.allSettled(newPositionRoles.map(role => this.addScrimsUserPosition(id_user, role, executor)))
            
        }

    }

    async getRoleUpdateAuditLogEntry(member, lostRoles, newRoles) {

        const fetchedLogs = await member.guild.fetchAuditLogs({ limit: 1, type: 'MEMBER_ROLE_UPDATE' })
            .catch(error => console.error(`Failed to fetch newest MEMBER_ROLE_UPDATE audit log entry!`, error))

        if (!fetchedLogs) return null;
        
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

    async addScrimsUserPosition(id_user, position, executor) {

        const selector = { id_user, id_position: position.id_position }
        const existing = await this.bot.database.userPositions.get({ ...selector, show_expired: true }, false).catch(console.error)
        if (existing && existing.length === 0) return this.sync.createScrimsPosition(selector, executor);

    }

    async removeScrimsUserPosition(id_user, member, position, executor) {

        const positionIdentifier = { id_user, id_position: position.id_position }

        const existing = await this.database.userPositions.get({ ...positionIdentifier, show_expired: true })

        if (existing.length > 0) {

            const success = await this.database.userPositions.remove( positionIdentifier ).then(() => true)
                .catch(error => console.error(`Unable to remove scrims user position for member ${member.user.tag} because of ${error}!`, positionIdentifier))

            if (success === true) {

                this.database.ipc.notify('audited_user_position_remove', { guild_id: member.guild.id, executor_id: (executor?.id ?? null), userPosition: existing[0] })

            }
            
        }

    }

    getRolesDifference(rolesA, rolesB) {

        return rolesA.cache.filter(roleA => rolesB.cache.filter(roleB => roleB.id === roleA.id).size === 0);

    }

    getPositionRoles(guildId, roles) {

        const positionRoles = this.bot.permissions.getGuildPositionRoles(guildId)
        return [ ...new Set(roles.map(role => positionRoles.filter(roleP => roleP.role_id === role.id)).flat()) ];

    }

    getPositionRolesDifference(guildId, rolesA, rolesB) {

        return this.getPositionRoles(guildId, this.getRolesDifference(rolesA, rolesB));

    }


}

module.exports = ScrimsPositionUpdater;