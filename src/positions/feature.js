const { GuildMember, Role, Guild } = require("discord.js");
const { interactionHandler, eventListeners, commands } = require("./commands");

class PositionsFeature {

    constructor(bot) {

        /** @type {import("../bot")} */
        this.bot = bot

        commands.forEach(([ cmdData, cmdPerms, cmdOptions ]) => this.bot.commands.add(cmdData, interactionHandler, cmdPerms, cmdOptions))
        eventListeners.forEach(eventName => this.bot.commands.add(eventName, interactionHandler))

        bot.on('databaseConnected', () => this.onStartup())

    }

    get database() {

        return this.bot.database;

    }

    async onStartup() {
        
        this.addEventHandlers()
        this.database.ipc.on('scrims_user_position_create', msg => this.onPositionCreate(msg.payload).catch(console.error))
        this.database.ipc.on('scrims_user_position_remove', msg => this.onPositionRemove(msg.payload).catch(console.error))

    }

    addEventHandlers() {

        this.bot.on('roleDelete', role => this.onRoleDelete(role).catch(console.error))
        this.bot.scrimsEvents.on('guildMemberAdd', member => this.onMemberAdd(member).catch(console.error))

    }

    /** @param {Role} role */
    async onRoleDelete(role) {

        const selector = { guild_id: role.guild.id, role_id: role.name }
        if (this.database.positionRoles.cache.find(selector)) {
            await this.database.positionRoles.remove(selector)
                then(() => this.database.ipc.notify('audited_position_role_remove', { executor_id: this.bot.user.id, selector }))
                .catch(console.error)
        }

    }

    /** @param {import("../lib/types").ScrimsGuildMember} member */
    async onMemberAdd(member) {

        const userPositions = await member.scrimsUser.fetchPositions().then(v => v.getUserPositions().filter(v => v?.position?.sticky))
        const discordRoleIds = userPositions.map(p => this.bot.permissions.getPositionRequiredRoles(member.guild.id, p.id_position)).flat()
        const missingRoleIds = Array.from(new Set(discordRoleIds.filter(roleId => !member.roles.cache.has(roleId))))
        const missingRoles = missingRoleIds.map(roleId => member.guild.roles.cache.get(roleId))
            .filter(role => role && this.bot.hasRolePermissions(role) && member.guild.id !== role.id)

        if (missingRoles.length > 0) {

            await Promise.all(
                missingRoles.map(
                    role => member.roles.add(role)
                        .catch(error => console.error(`Unable to add position roles to ${member.user.tag} because of ${error}!`, userPositions, role))
                )
            )

            const addedRoles = missingRoles.filter(role => member.roles.cache.has(role.id)).map(role => `${role}`)
            if (addedRoles.length > 0) this.database.ipc.notify(`joined_discord_roles_received`, { guild_id: member.guild.id, executor_id: member.id, roles: addedRoles })
        
        }

    }

    async onPositionCreate(userPosition) {

        const { user, id_position } = userPosition

        await Promise.allSettled(
            this.bot.guilds.cache.map(
                guild => guild.members.fetch(user.discord_id)
                    .then(member => this.givePositionRoles(member, id_position).catch(console.error))
            )
        )

    }

    /**
     * @param {GuildMember} member
     * @param {number} id_position
     */
    async givePositionRoles(member, id_position) {

        const roles = this.bot.permissions.getPositionRequiredRoles(member.guild.id, id_position)
            .filter(roleId => !member.roles.cache.has(roleId))
            .map(roleId => member.guild.roles.cache.get(roleId))
            .filter(role => role && this.bot.hasRolePermissions(role) && member.guild.id !== role.id)
            
        if (roles.length > 0) {

            await Promise.all(
                roles.map(
                    role => member.roles.add(role)
                        .catch(error => console.error(`Adding roles failed because of ${error}!`, member.guild.id, id_position, role))
                )
            )

            const addedRoles = roles.filter(role => member.roles.cache.has(role.id)).map(role => `${role}`)
            if (addedRoles.length > 0) this.database.ipc.notify(`position_discord_roles_received`, { guild_id: member.guild.id, executor_id: member.id, id_position, roles: addedRoles })

        }

    }

    async onPositionRemove(userPositionSelector) {

        const { id_user, id_position } = userPositionSelector

        const scrimsUser = this.database.users.cache.find(id_user)
        if (!scrimsUser) return false;

        const userPositions = await scrimsUser.fetchPositions()

        await Promise.allSettled(
            this.bot.guilds.cache.map(
                guild => guild.members.fetch(scrimsUser.discord_id)
                    .then(member => this.removePositionRoles(member, userPositions, id_position).catch(console.error))
            )
        )

    }

    /**
     * @param {GuildMember} member 
     * @param {number} id_position 
     */
    async removePositionRoles(member, userPositions, id_position) {

        const roles = this.bot.permissions.getPositionRequiredRoles(member.guild.id, id_position)
            .filter(roleId => !this.bot.permissions.hasRequiredRolesPositions(member, userPositions, roleId, true))
            .map(roleId => member.roles.cache.get(roleId))
            .filter(role => role && this.bot.hasRolePermissions(role) && member.guild.id !== role.id)
  
        if (roles.length > 0) {

            await member.roles.remove(roles)
                .catch(error => console.error(`Removing roles failed because of ${error}!`, member.guild.id, id_position, roles))

            const lostRoles = roles.filter(role => !member.roles.cache.has(role.id)).map(role => `${role}`)
            if (lostRoles.length > 0) this.database.ipc.notify(`position_discord_roles_lost`, { guild_id: member.guild.id, executor_id: member.id, id_position, roles: lostRoles })
            
        }
        
    }

    /** @param {import("../lib/types").ScrimsGuildMember} member */
    getMemberMissingRoles(member, userPositions) {

        const usersPositions = member.scrimsUser.getPositions(userPositions)
        return Array.from(
            new Set(
                usersPositions.getPositions()
                    .map(pos => this.bot.permissions.getPositionRequiredPositionRoles(member.guild.id, pos)).flat()
                    .filter(pRole => !member.roles.cache.has(pRole.role_id))
                    .filter(pRole => pRole.role && this.bot.hasRolePermissions(pRole.role) && member.guild.id !== pRole.role_id)
                    .map(pRole => pRole.role_id)
            )
        );

    }

    /** @param {import("../lib/types").ScrimsGuildMember} member */
    getMemberUnallowedRoles(member, userPositions) {

        const usersPositions = member.scrimsUser.getPositions(userPositions)
        return Array.from(
            new Set(
                this.bot.permissions.getGuildPositionRoles(member.guild.id)
                    .filter(pRole => !this.bot.permissions.hasRequiredRolesPositions(member, usersPositions, pRole.role_id, true))
                    .filter(pRole => member.roles.cache.has(pRole.role_id))
                    .filter(pRole => pRole.role && this.bot.hasRolePermissions(pRole.role) && member.guild.id !== pRole.role_id)
                    .map(pRole => pRole.role_id)
            )
        );

    }

    /** @param {Guild} guild */
    async getMembersRolesDifference(guild) {

        const members = guild.members.cache.filter(member => member.scrimsUser)
        const userPositions = await this.database.userPositions.getArrayMap({}, ["id_user"], false)
        return Promise.all(members.map(member => [ this.getMemberMissingRoles(member, userPositions), this.getMemberUnallowedRoles(member, userPositions) ]));

    }

    /** @param {Guild} guild */
    async syncPositions(guild) {

        const members = guild.members.cache.filter(member => member.scrimsUser)
        const userPositions = await this.database.userPositions.getArrayMap({}, ["id_user"], false)

        return Promise.all(members.map(member => this.syncPositionsForMember(member, userPositions)))
            .then(results => results.reduce(([rmv, create], [removeResults, createResults]) => [ [...rmv, ...removeResults], [...create, ...createResults] ], [[], []]))

    }

    /** @param {GuildMember} member */
    async syncPositionsForMember(member, userPositions) {

        const unallowedRoles = this.getMemberUnallowedRoles(member, userPositions)
        const missingRoles = this.getMemberMissingRoles(member, userPositions)

        const removeResults = await Promise.all(
            unallowedRoles.map(role_id => (
                member.roles.remove(role_id).then(() => true)
                    .catch(error => console.error(`Unable to remove role because of ${error}!`, role_id))
            ))
        )

        const createResults = await Promise.all(
            missingRoles.map(role_id => (
                member.roles.add(role_id).then(() => true)
                    .catch(error => console.error(`Unable to give role because of ${error}!`, role_id))
            ))
        )

        return [removeResults, createResults];

    }

}

module.exports = PositionsFeature;