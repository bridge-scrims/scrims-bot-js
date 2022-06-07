const { GuildMember } = require("discord.js");
const { interactionHandler, eventListeners, commands } = require("./commands");

class PositionsFeature {

    constructor(bot) {

        /** @type {import("../bot")} */
        this.bot = bot

        commands.forEach(([ cmdData, cmdPerms, cmdOptions ]) => this.bot.commands.add(cmdData, cmdPerms, cmdOptions))
        
        bot.on('ready', () => this.onReady())
        bot.on('databaseConnected', () => this.onStartup())

    }

    get database() {

        return this.bot.database;

    }

    async onReady() {

        

    }

    async onStartup() {
        
        this.addEventHandlers()
        this.database.ipc.on('scrims_user_position_create', msg => this.onPositionCreate(msg.payload).catch(console.error))
        this.database.ipc.on('scrims_user_position_remove', msg => this.onPositionRemove(msg.payload).catch(console.error))

    }

    addEventHandlers() {

        commands.forEach(([ cmdData, _ ]) => this.bot.addEventHandler(cmdData.name, interactionHandler))
        eventListeners.forEach(eventName => this.bot.addEventHandler(eventName, interactionHandler))

        this.bot.on('roleDelete', role => this.onRoleDelete(role).catch(console.error))
        this.bot.on('scrimsGuildMemberAdd', member => this.onMemberAdd(member).catch(console.error))

    }

    botHasRolePermissions(role) {

        const botMember = role.guild.members.cache.get(this.bot.user.id)
        if (!botMember) return false;
        
        const largest = Math.max( ...botMember.roles.cache.map(role => role.position) )
        return (largest > role.position);

    }

    async logError(msg, context) {

        if (context.error) console.error(`${msg} Reason: ${context.error}`)
        this.database.ipc.notify(`position_error`, { msg, ...context })

    }

    async onRoleDelete(role) {

        const selector = { guild_id: role.guild.id, role_id: role.id }
        await this.database.positionRoles.remove(selector)
            .then(() => this.database.ipc.notify('audited_position_role_remove', { executor_id: this.bot.user.id, selector }))
            .catch(console.error)

    }

    /**
     * @param { GuildMember } member 
     */
    async onMemberAdd(member) {

        const userPositions = this.bot.database.userPositions.cache.get({ id_user: member.scrimsUser.id_user, position: { sticky: true } })
        const discordRoleIds = userPositions.map(p => this.bot.permissions.getPositionRequiredRoles(member.guild.id, p.id_position)).flat()
        const missingRoleIds = [ ...new Set(discordRoleIds.filter(roleId => !member.roles.cache.has(roleId))) ].filter(roleId => !member.guild.roles.cache.get(roleId)?.managed)

        if (missingRoleIds.length > 0) {

            await Promise.all(
                missingRoleIds.map(
                    roleId => member.roles.add(roleId)
                        .catch(error => console.error(`Unable to add position roles to ${member.user.tag} because of ${error}!`, userPositions, roleId))
                )
            )

            const addedRoles = missingRoleIds.filter(id => member.roles.cache.has(id)).map(id => `${member.roles.cache.get(id)}`)
            if (addedRoles.length > 0 ) this.database.ipc.notify(`joined_discord_roles_received`, { guild_id: member.guild.id, executor_id: member.id, roles: addedRoles })
        
        }

    }

    async onPositionCreate(userPosition) {

        const { user, id_position } = userPosition

        await Promise.allSettled(
            this.bot.guilds.cache.map(
                guild => guild.members.fetch(user.discord_id)
                    .then(member => this.givePositionRoles(member, id_position))
            )
        )

    }

    async givePositionRoles(member, id_position) {

        const roleIds = this.bot.permissions.getPositionRequiredRoles(member.guild.id, id_position)
            .filter(roleId => !member.roles.cache.has(roleId))
            .filter(roleId => !member.guild.roles.cache.get(roleId)?.managed && member.guild.id !== roleId)

        if (roleIds.length > 0) {

            await Promise.all(
                roleIds.map(
                    roleId => member.roles.add(roleId)
                        .catch(error => console.error(`Adding roles failed because of ${error}!`, member.guild.id, id_position, roleId))
                )
            )

            const addedRoles = roleIds.filter(id => member.roles.cache.has(id)).map(id => `${member.roles.cache.get(id)}`)
            if (addedRoles.length > 0) this.database.ipc.notify(`position_discord_roles_received`, { guild_id: member.guild.id, executor_id: member.id, id_position, roles: addedRoles })

        }

    }

    async onPositionRemove(userPositionSelector) {

        const { id_user, id_position } = userPositionSelector
        const scrimsUsers = await this.database.users.fetch({ id_user }).catch(console.error)
        if (!scrimsUsers || scrimsUsers.length === 0) return false;

        await Promise.allSettled(
            this.bot.guilds.cache.map(
                guild => guild.members.fetch(scrimsUsers[0].discord_id)
                    .then(member => this.removePositionRoles(member, id_position))
            )
        )

    }

    async removePositionRoles(member, id_position) {

        const roleIds = this.bot.permissions.getPositionRequiredRoles(member.guild.id, id_position)
            .filter(roleId => member.roles.cache.has(roleId))
            .filter(roleId => !member.roles.cache.get(roleId).managed && member.guild.id !== roleId)
        
        const roles = roleIds.map(id => `${member.roles.cache.get(id)}`)

        if (roleIds.length > 0) {

            const success = await member.roles.remove(roleIds).then(() => true)
                .catch(error => console.error(`Removing roles failed because of ${error}!`, member.guild.id, id_position. roleIds))

            if (success === true && roles.length > 0) this.database.ipc.notify(`position_discord_roles_lost`, { guild_id: member.guild.id, executor_id: member.id, id_position, roles })
            
        }
        
    }

    getMemberMissingRoles(member, userPositions) {

        return Array.from(
            new Set(
                userPositions.map(userPos => this.bot.permissions.getPositionRequiredPositionRoles(member.guild.id, userPos.id_position)).flat()
                    .filter(pRole => !member.roles.cache.has(pRole.role_id))
                    .filter(pRole => !member.guild.roles.cache.get(pRole.role_id)?.managed)
                    .map(pRole => pRole.role_id)
            )
        );

    }

    getMemberUnallowedRoles(member, userPositions) {

        return Array.from(
            new Set(
                this.bot.permissions.getGuildPositionRoles(member.guild.id)
                    .filter(pRole => !userPositions.find(userPos => userPos.id_position === pRole.id_position))
                    .filter(pRole => member.roles.cache.has(pRole.role_id))
                    .filter(pRole => !member.guild.roles.cache.get(pRole.role_id)?.managed)
                    .map(pRole => pRole.role_id)
            )
        );

    }

    memberIsAllowedPosition(member, position) {

        const requiredRoles = this.bot.permissions.getPositionRequiredRoles(member.guild.id, position.id_position)
        return (requiredRoles.every(roleId => member.roles.cache.has(roleId)));

    }

    async getMembersRolesDifference(guild) {

        const members = await guild.members.fetch()
        const userPositions = await this.database.userPositions.getArrayMap({}, ["user", "discord_id"], false)

        return Promise.all(members.map(member => [ this.getMemberMissingRoles(member, userPositions[member.id] ?? [] ), this.getMemberUnallowedRoles(member, userPositions[member.id] ?? []) ]));

    }

    async syncPositions(guild) {

        const members = await guild.members.fetch()
        const userPositions = await this.database.userPositions.getArrayMap({}, ["user", "discord_id"], false)

        return Promise.all(members.map(member => this.syncPositionsForMember(member, userPositions[member.id] ?? [])))
            .then(results => results.reduce(([rmv, create], [removeResults, createResults]) => [ [...rmv, ...removeResults], [...create, ...createResults] ], [[], []]))

    }

    /**
     * @param {GuildMember} member 
     */
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