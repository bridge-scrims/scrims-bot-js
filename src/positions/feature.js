
const { interactionHandler, eventListeners, commands } = require("./commands");

class PositionsFeature {

    constructor(bot) {

        /**
         * @type { import("../bot") }
         */
        this.bot = bot

        commands.forEach(([ cmdData, cmdPerms ]) => this.bot.commands.add(cmdData, cmdPerms))
        
        bot.on('ready', () => this.onReady())
        bot.on('startupComplete', () => this.onStartup())

    }

    get database() {

        return this.bot.database;

    }

    async onReady() {

        this.addEventHandlers()

    }

    async onStartup() {
        
        this.database.ipc.on('user_position_create', msg => this.onPositionCreate(msg.payload))
        this.database.ipc.on('user_position_remove', msg => this.onPositionRemove(msg.payload))

    }

    addEventHandlers() {

        commands.forEach(([ cmdData, _ ]) => this.bot.addEventHandler(cmdData.name, interactionHandler))
        eventListeners.forEach(eventName => this.bot.addEventHandler(eventName, interactionHandler))

        this.bot.on('roleDelete', role => this.onRoleDelete(role))
        this.bot.on('scrimsGuildMemberAdd', member => this.onMemberAdd(member))

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

        await this.database.positionRoles.remove({ guild_id: role.guild.id, role_id: role.id }).catch(console.error)

    }

    async onMemberAdd(member) {

        const userPositions = this.bot.database.userPositions.cache.find({ id_user: member.scrimsUser.id_user, position: { sticky: true } })
        const discordRoleIds = userPositions.map(p => this.bot.permissions.getPositionRequiredRoles(member.guild.id, p.id_position)).flat()
        const missingRoleIds = [ ...new Set(discordRoleIds.filter(roleId => !member.roles.cache.has(roleId))) ]
        const missingRoles = missingRoleIds.map(id => member.guild.roles.cache.get(id) ?? id)

        if (missingRoleIds.length > 0) {

            this.database.ipc.notify(`joined_discord_roles_received`, { guild_id: member.guild.id, executor_id: member.id, roles: missingRoles })

            await member.roles.add(missingRoleIds) 
                .catch(error => console.error(`Unable to add position roles to ${member.user.tag} because of ${error}!`, userPositions, missingRoleIds))
        
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

        const roleIds = this.bot.permissions.getPositionRequiredRoles(member.guild.id, id_position).filter(roleId => !member.roles.cache.has(roleId))
        const roles = roleIds.map(id => member.guild.roles.cache.get(id) ?? id)

        if (roleIds.length > 0) {

            const success = await member.roles.add(roleIds).then(() => true)
                .catch(error => console.error(`Adding roles failed because of ${error}!`, member.guild.id, id_position. roleIds))

            if (success === true) this.database.ipc.notify(`position_discord_roles_received`, { guild_id: member.guild.id, executor_id: member.id, id_position, roles })

        }

    }

    async onPositionRemove(userPositionSelector) {

        const { id_user, id_position } = userPositionSelector
        const scrimsUsers = await this.database.users.get({ id_user }).catch(console.error)
        if (!scrimsUsers || scrimsUsers.length === 0) return false;

        await Promise.allSettled(
            this.bot.guilds.cache.map(
                guild => guild.members.fetch(scrimsUsers[0].discord_id)
                    .then(member => this.removePositionRoles(member, id_position))
            )
        )

    }

    async removePositionRoles(member, id_position) {

        const roleIds = this.bot.permissions.getPositionRequiredRoles(member.guild.id, id_position).filter(roleId => member.roles.cache.has(roleId))
        const roles = roleIds.map(id => member.guild.roles.cache.get(id) ?? id)

        if (roleIds.length > 0) {

            const success = await member.roles.remove(roleIds).then(() => true)
                .catch(error => console.error(`Removing roles failed because of ${error}!`, member.guild.id, id_position. roleIds))

            if (success === true) this.database.ipc.notify(`position_discord_roles_lost`, { guild_id: member.guild.id, executor_id: member.id, id_position, roles })
            
        }
        
    }

    async getMemberMissingRoles(member) {

        const userPositions = await this.database.userPositions.get({ user: { discord_id: member.id } }, false)
        const userRoleIds = userPositions.map(userPos => this.bot.permissions.getPositionRequiredRoles(member.guild.id, userPos.id_position)).flat()
        const missingRoleIds = userRoleIds.filter(roleId => !member.roles.cache.has(roleId))

        return [ ...(new Set(missingRoleIds)) ];

    }

    async getMemberUnallowedRoles(member) {

        const allPositionRoles = this.bot.permissions.getGuildPositionRoles(member.guild.id)
        const unallowedPositionRoles = allPositionRoles.filter(pRole => !this.bot.permissions.hasRequiredPositionRoles(member, pRole.id_position))
        const unallowedRoleIds = unallowedPositionRoles.map(pRole => pRole.role_id).flat().filter(roleId => member.roles.cache.has(roleId))

        return [ ...(new Set(unallowedRoleIds)) ];

    }

    memberIsAllowedPosition(member, position) {

        const requiredRoles = this.bot.permissions.getPositionRequiredRoles(member.guild.id, position.id_position)
        return (requiredRoles.every(roleId => member.roles.cache.has(roleId)));

    }

    async getMembersRolesDifference(guild) {

        const members = await guild.members.fetch()
        return Promise.all(members.map(member => Promise.all([ this.getMemberMissingRoles(member), this.getMemberUnallowedRoles(member) ])));

    }

}

module.exports = PositionsFeature;