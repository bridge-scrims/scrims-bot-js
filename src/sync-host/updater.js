const { GuildMember, GuildBan } = require('discord.js');
const ScrimsPositionRole = require('../lib/scrims/position_role');
const ScrimsUserPosition = require('../lib/scrims/user_position');

class ScrimsPositionUpdater {


    constructor(syncHostFeature) {

        /** @type {import('./feature')} */
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

        this.bot.scrimsEvents.on('memberRolesUpdate', (oldMember, newMember) => this.onMemberUpdate(oldMember, newMember, newMember.executor).catch(console.error))
        
        this.bot.on('guildMemberRemove', member => this.onMemberRemove(member).catch(console.error))
        this.bot.scrimsEvents.on('guildMemberAdd', member => this.onMemberAdd(member).catch(console.error))

        this.bot.scrimsEvents.on('banAdd', ban => this.onBanAdd(ban).catch(console.error))
        this.bot.scrimsEvents.on('banRemove', ban => this.onBanRemove(ban).catch(console.error))

        this.database.positionRoles.cache.on('change', positionRole => this.onPositionRoleChange(positionRole).catch(console.error))

    }

    /** @param {GuildBan} ban */
    async onBanAdd(ban) {

        const bannedPosition = this.bot.database.positions.cache.find({ name: "banned" })
        if (!bannedPosition || !ban?.user) return false;
        if (!ban.user.scrimsUser) this.bot.expandUser(ban.user)
        if (!ban.user.scrimsUser) return false;

        if ((await ban.user.scrimsUser.fetchPositions(true).then(v => v.hasPosition(bannedPosition)))) return false;

        const userPosition = new ScrimsUserPosition(this.database)
            .setUser(ban.user.scrimsUser).setPosition(bannedPosition).setGivenPoint().setExecutor(ban?.executor?.scrimsUser)
        
        await this.database.userPositions.create(userPosition)

    }

    /** @param {GuildBan} ban */
    async onBanRemove(ban) {

        const bannedPosition = this.bot.database.positions.cache.find({ name: "banned" })
        if (!bannedPosition || !ban?.user?.scrimsUser) return false;
        if (!ban.user.scrimsUser) this.bot.expandUser(ban.user)
        if (!ban.user.scrimsUser) return false;

        if (!(await ban.user.scrimsUser.fetchPositions(true).then(v => v.hasPosition(bannedPosition)))) return false;

        const removed = await this.database.userPositions.remove({ id_user: ban.user.scrimsUser.id_user, id_position: bannedPosition.id_position })
        if (removed.length > 0) this.database.ipc.notify("audited_user_position_remove", { id_executor: ban?.executor?.scrimsUser?.id_user, userPosition: removed[0] })

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
        if (!position) return false;

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
            
            await this.sync.scrimsMemberRemove(member.scrimsUser, (await member.scrimsUser.fetchPositions(true)))

        }

    }

    async onMemberAdd(member) {

        if (member.guild.id === this.hostGuildId) {

            // Make sure the user lost their non sticky positions when they left
            if (member.scrimsUser) await this.sync.removeUnstickyPositions(member.scrimsUser, (await member.scrimsUser.fetchPositions(true)))

        }

    }

    /**
     * @param {GuildMember} oldMember 
     * @param {import("../lib/types").ScrimsGuildMember} member 
     * @param {import("../lib/types").ScrimsGuildMember} [executor] 
     */
    async onMemberUpdate(oldMember, member, executor) {

        if (oldMember.roles.cache.size === member.roles.cache.size) return false;
        if (member.guild.id !== this.hostGuildId) return false;
        if (!member.scrimsUser) return false;
        
        const userPositions = await member.scrimsUser.fetchPositions(true)
        const missing = this.sync.getMemberMissingPositions(member, member.scrimsUser, userPositions)
        const unallowed = this.sync.getMemberUnallowedPositions(member, member.scrimsUser, userPositions)
        await this.sync.transferPositionsForMember(executor?.id_user ?? null, member.scrimsUser, missing, unallowed)

    }

}

module.exports = ScrimsPositionUpdater;