
const { interactionHandler, eventListeners, commands } = require("./commands");

class PositionsFeature {

    constructor(bot, config) {

        this.bot = bot
        this.config = config;
        
        if (config) Object.entries(config).forEach(([key, value]) => this[key] = value)

        commands.forEach(([ cmdData, cmdPerms ]) => this.bot.commands.add(cmdData, cmdPerms))
        
        bot.on('ready', () => this.onReady())
        bot.on('startupComplete', () => this.onStartup())

    }

    async onReady() {

        this.addEventHandlers()

    }

    async onStartup() {
        
        this.bot.database.ipc.on('user_position_create', msg => this.onPositionCreate(msg.payload))
        this.bot.database.ipc.on('user_position_remove', msg => this.onPositionRemove(msg.payload))

    }

    addEventHandlers() {

        commands.forEach(([ cmdData, _ ]) => this.bot.addEventHandler(cmdData.name, interactionHandler))
        eventListeners.forEach(eventName => this.bot.addEventHandler(eventName, interactionHandler))

        this.bot.on('roleDelete', role => this.onRoleDelete(role))

    }

    botHasRolePermissions(role) {

        const botMember = role.guild.members.cache.get(this.bot.user.id)
        if (!botMember) return false;
        
        const largest = Math.max( ...botMember.roles.cache.map(role => role.position) )
        return (largest > role.position);

    }

    async onRoleDelete(role) {

        await this.bot.database.positionRoles.remove({ guild_id: role.guild.id, role_id: role.id }).catch(console.error)

    }

    async onPositionCreate(userPosition) {

        const { user, id_position } = userPosition

        await Promise.allSettled(
            this.bot.guilds.cache.map(
                guild => guild.members.fetch(user.discord_id)
                    .then(member => member.roles.add(this.bot.permissions.getPositionRequiredRoles(guild.id, id_position)).catch(console.error))
            )
        )

    }

    async onPositionRemove(userPositionSelector) {

        const { id_user, id_position } = userPositionSelector
        const scrimsUsers = await this.bot.database.users.get({ id_user }).catch(console.error)
        if (!scrimsUsers || scrimsUsers.length === 0) return false;

        await Promise.allSettled(
            this.bot.guilds.cache.map(
                guild => guild.members.fetch(scrimsUsers[0].discord_id)
                    .then(member => member.roles.remove(this.bot.permissions.getPositionRequiredRoles(guild.id, id_position)).catch(console.error))
            )
        )

    }

    async getMemberMissingRoles(member) {

        const userPositions = await this.bot.database.userPositions.get({ user: { discord_id: member.id } }, false)
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