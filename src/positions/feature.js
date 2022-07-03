const { GuildMember, Role, Guild } = require("discord.js");
const ScrimsUserPosition = require("../lib/scrims/user_position");
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
        this.database.ipc.on('audited_user_position_remove', msg => this.onPositionRemove(msg.payload).catch(console.error))
        this.database.ipc.on('scrims_user_position_expire', msg => this.onPositionExpire(msg.payload).catch(console.error))

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

        const userPositions = await member.scrimsUser.fetchUserPositions()
        const missingRoles = this.getMemberMissingRoles(member, userPositions)

        if (missingRoles.length > 0) {

            await Promise.all(
                missingRoles.map(
                    role => member.roles.add(role)
                        .catch(error => console.error(`Unable to add position roles to ${member.user.tag} because of ${error}!`, role))
                )
            )

            const addedRoles = missingRoles.map(role => member.guild.roles.cache.get(role)).filter(v => v).map(role => `${role}`)
            if (addedRoles.length > 0) this.database.ipc.notify(`joined_discord_roles_received`, { guild_id: member.guild.id, executor_id: member.id, roles: addedRoles })
        
        }

    }

    async onPositionCreate(userPositionData) {

        const userPosition = new ScrimsUserPosition(this.database, userPositionData)
        const members = this.bot.guilds.cache.map(guild => userPosition.user.getMember(guild)).filter(v => v)
        const userPositions = await userPosition.user.fetchPositions()

        await Promise.allSettled(members.map(member => this.givePositionRoles(member, userPosition, userPositions).catch(console.error)))

        if (userPosition?.position?.name === "banned") {
            const userPositions = await userPosition.user.fetchPositions()
            await Promise.allSettled(members.map(member => this.syncPositionsForMember(member, userPositions).catch(console.error)));
        }

    }

    /**
     * @param {import("../lib/types").ScrimsGuildMember} member
     * @param {ScrimsUserPosition} userPosition
     */
    async givePositionRoles(member, userPosition, userPositions) {

        const roles = this.bot.permissions.getPositionRequiredRoles(member.guild.id, userPosition.id_position)
            .filter(roleId => this.bot.permissions.hasRequiredRolesPositions(member, userPositions, roleId, true))
            .filter(roleId => !member.roles.cache.has(roleId))
            .map(roleId => member.guild.roles.cache.get(roleId))
            .filter(role => role && this.bot.hasRolePermissions(role) && member.guild.id !== role.id)
            
        if (roles.length > 0) {

            await Promise.all(
                roles.map(
                    role => member.roles.add(role, "Bridge scrims user position received.")
                        .catch(error => console.error(`Adding roles failed because of ${error}!`, member.guild.id, userPosition.id_position, role.id))
                )
            )

            const addedRoles = roles.filter(role => member.roles.cache.has(role.id)).map(role => `${role}`)
            if (addedRoles.length > 0) this.database.ipc.notify(`position_discord_roles_received`, { guild_id: member.guild.id, executor_id: member.id, userPosition, roles: addedRoles })

        }

    }

    async onPositionRemove(eventPayload) {

        const userPosition = new ScrimsUserPosition(this.database, eventPayload.userPosition)
        const remover = { id_user: eventPayload.id_executor, discord_id: eventPayload.executor_id, userPosition: undefined }
        const userPositions = await userPosition.user.fetchPositions()
        const members = this.bot.guilds.cache.map(guild => userPosition.user.getMember(guild)).filter(v => v)
        await Promise.allSettled(
            members.map(async member => {
                const roles = await this.removePositionRoles(member, userPositions, userPosition).catch(console.error)
                const payload = { guild_id: member.guild.id, executor_id: member.id, remover, userPosition, roles }
                if (roles?.length > 0) this.database.ipc.notify(`position_discord_roles_lost`, payload)
            })
        )
    
    }

    async onPositionExpire(userPositionData) {

        const userPosition = new ScrimsUserPosition(this.database, userPositionData)
        const userPositions = await userPosition.user.fetchPositions()
        const members = this.bot.guilds.cache.map(guild => userPosition.user.getMember(guild)).filter(v => v)
        await Promise.allSettled(
            members.map(async member => {
                const roles = await this.removePositionRoles(member, userPositions, userPosition).catch(console.error)
                const payload = { guild_id: member.guild.id, executor_id: member.id, userPosition, roles }
                if (roles?.length > 0) this.database.ipc.notify(`position_discord_roles_lost_expired`, payload)
            })
        )

    }

    /**
     * @param {GuildMember} member 
     * @param {number} id_position 
     */
    async removePositionRoles(member, userPositions, userPosition) {

        const roles = this.bot.permissions.getPositionRequiredRoles(member.guild.id, userPosition.id_position)
            .filter(roleId => !this.bot.permissions.hasRequiredRolesPositions(member, userPositions, roleId, true))
            .map(roleId => member.roles.cache.get(roleId))
            .filter(role => role && this.bot.hasRolePermissions(role) && member.guild.id !== role.id)
  
        if (roles.length > 0) {

            await member.roles.remove(roles, "Bridge scrims user position lost.")
                .catch(error => console.error(`Removing roles failed because of ${error}!`, member.guild.id, userPosition.id_position, roles.map(role => role.id)))
            
        }

        if (userPosition?.position?.name === "banned") 
            await this.syncPositionsForMember(member, userPositions).catch(console.error)
        return roles.filter(role => !member.roles.cache.has(role.id)).map(role => `${role}`);

    }

    /** @param {import("../lib/types").ScrimsGuildMember} member */
    getMemberMissingRoles(member, userPositions) {

        const usersPositions = member.scrimsUser.getPositions(userPositions)
        return Array.from(
            new Set(
                this.bot.permissions.getGuildPositionRoles(member.guild.id)
                    .filter(pRole => this.bot.permissions.hasRequiredRolesPositions(member, usersPositions, pRole.role_id, false))
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