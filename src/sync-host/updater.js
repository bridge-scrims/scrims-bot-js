const { GuildMember } = require('discord.js');
const ScrimsPositionRole = require('../lib/scrims/position_role');

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

        this.bot.on('scrimsMemberPositionRoleUpdate', ({ member, lostPositionRoles, newPositionRoles, executor }) => this.onMemberUpdate(member, lostPositionRoles, newPositionRoles, executor).catch(console.error))
        
        this.bot.on('guildMemberRemove', member => this.onMemberRemove(member).catch(console.error))
        this.bot.on('scrimsGuildMemberAdd', member => this.onMemberAdd(member).catch(console.error))

        this.database.positionRoles.cache.on('change', positionRole => this.onPositionRoleChange(positionRole).catch(console.error))

    }

    async onPositionRoleChange(positionRole) {

        if (positionRole.guild_id === this.hostGuildId) {

            return this.reloadPositionMembers(positionRole.id_position);

        }
            
    }

    async reloadPositionMembers(id_position) {

        const members = await this.sync.fetchHostGuildMembers()
        if (!members) return false;

        const position = this.database.positions.cache.find(id_position)
        if (!position || position.name === "bridge_scrims_member") return false;

        const scrimsUsers = await this.database.users.getMap({}, ['discord_id'])
            .catch(error => console.error(`Unable to fetch scrims users because of ${error}!`, id_position))
          
        const userPositions = await this.database.userPositions.getArrayMap({}, ['user', 'discord_id'], false)
            .catch(error => console.error(`Unable to fetch scrims user positions because of ${error}!`, id_position))

        if (scrimsUsers && userPositions) 
            await Promise.all(members.map(member => this.reloadMemberPosition(member, scrimsUsers[member.id]?.id_user, id_position, userPositions[member.id])))

    }

    async reloadMemberPosition(member, id_user, id_position, userPositions=[]) {

        if (!id_user) return false;

        const userPosition = userPositions.filter(userPos => userPos.id_user === id_user && userPos.id_position === id_position)[0]
        const shouldHavePossition = this.bot.permissions.hasRequiredPositionRoles(member, id_position, false)
        
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

        if (member.guild.id === this.hostGuildId && member.scrimsUser) {
            
            await this.sync.scrimsMemberRemove(member.scrimsUser, Object.values(await member.scrimsUser.fetchPositions(true)))

        }

    }

    async onMemberAdd(member) {

        if (member.guild.id === this.hostGuildId) {

            // Make sure the user lost their non sticky positions when they left
            if (member.scrimsUser) await this.sync.removeUnstickyPositions(member.scrimsUser, Object.values(await member.scrimsUser.fetchPositions(true)))

        }

    }

    /**
     * @param {GuildMember} member 
     * @param {ScrimsPositionRole[]} lostPositionRoles 
     * @param {ScrimsPositionRole[]} newPositionRoles 
     * @param {GuildMember} executor 
     */
    async onMemberUpdate(member, lostPositionRoles, newPositionRoles, executor) {

        if (member.guild.id !== this.hostGuildId) return false;

        const id_user = this.database.users.cache.find({ discord_id: member.id })?.id_user
        if (!id_user) return false; // User has not been added to the bridge scrims database

        if (lostPositionRoles.length > 0) await Promise.allSettled(lostPositionRoles.map(role => this.removeScrimsUserPosition(id_user, member, role, executor).catch(console.error)))
        if (newPositionRoles.length > 0) await Promise.allSettled(newPositionRoles.map(role => this.addScrimsUserPosition(id_user, role, executor).catch(console.error)))
            

    }

    async addScrimsUserPosition(id_user, position, executor) {

        if (position.dontLog) return false;
        const selector = { id_user, id_position: position.id_position }
        const existing = await this.bot.database.userPositions.fetch({ ...selector, show_expired: true }, false)
        if (existing && existing.length === 0) return this.sync.createScrimsPosition(selector, executor);

    }

    async removeScrimsUserPosition(id_user, member, position, executor) {

        if (position.dontLog) return false;

        const positionIdentifier = { id_user, id_position: position.id_position }

        const existing = await this.database.userPositions.fetch({ ...positionIdentifier, show_expired: true })

        if (existing.length > 0) {

            const success = await this.database.userPositions.remove(positionIdentifier).then(() => true)
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