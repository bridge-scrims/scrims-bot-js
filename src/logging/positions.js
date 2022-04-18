const ScrimsPositionRole = require("../lib/scrims/position_role");
const ScrimsUserPosition = require("../lib/scrims/user_position");
const ScrimsPosition = require("../lib/scrims/position");

class PositionLoggingFeature {

    constructor(bot) {

        /**
         * @type { import("../bot") }
         */
        this.bot = bot

        bot.on('databaseConnected', () => this.addListeners())

    }

    get database() {

        return this.bot.database;

    }

    get logging() {

        return this.bot.logging;

    }

    addListeners() {

        this.database.ipc.on('positions_error', message => this.onPositionsError(message.payload).catch(console.error))
        this.database.ipc.on('audited_position_role_create', message => this.onPositionRoleCreate(message.payload).catch(console.error))
        this.database.ipc.on('audited_position_role_remove', message => this.onPositionRoleRemove(message.payload).catch(console.error))
    
        this.database.ipc.on('audited_user_position_remove', message => this.onUserPositionRemove(message.payload).catch(console.error))
        this.database.ipc.on('audited_user_position_expire_update', message => this.onUserPositionExpireUpdate(message.payload).catch(console.error))
        this.database.ipc.on('user_position_create', message => this.onUserPositionCreate(message.payload).catch(console.error))
        
        this.database.ipc.on('audited_position_create', message => this.onPositionCreate(message.payload).catch(console.error))
        this.database.ipc.on('audited_position_remove', message => this.onPositionRemove(message.payload).catch(console.error))
        
        this.database.ipc.on('joined_discord_roles_received', message => this.onJoinedRolesReceived(message.payload).catch(console.error))
        this.database.ipc.on('position_discord_roles_received', message => this.onPositionRolesReceived(message.payload).catch(console.error))
        this.database.ipc.on('position_discord_roles_lost', message => this.onPositionRolesLost(message.payload).catch(console.error))

    }

    async onPositionsError(payload) {

        return this.logging.sendLogMessages(payload, "positions_log_channel", "Positions Error", '#D3011C');

    }

    async onPositionRoleCreate(payload) {

        if (!payload.positionRole) {

            const msg = `Created an unknown new positions role.`
            return this.logging.sendLogMessages({ msg, ...payload }, "positions_log_channel", "Position Role Created", '#0098EB');

        }

        const positionRole = new ScrimsPositionRole(this.database, payload.positionRole)
        const role = positionRole.role ? `@${positionRole.role.name}` : positionRole.role_id
        const position = positionRole.position?.name ?? positionRole.id_position

        const msg = `Connected discord **${role}** to bridge scrims **${position}**.`
        return this.logging.sendLogMessages({ msg, ...payload }, "positions_log_channel", "Position Role Created", '#0098EB');

    }

    async onPositionRoleRemove(payload) {

        payload = { guild_id: payload?.selector?.scrimsGuild?.discord_id, ...payload }

        const guild = payload.guild_id ? this.bot.guilds.resolve(payload.guild_id) : null
        const role = (guild && payload?.selector?.role_id) ? `@${guild.roles.resolve(payload?.selector?.role_id)?.name}` : payload?.selector?.role_id

        const position = (payload?.selector?.id_position) ? this.database.positions.cache.get({ id_position: payload.selector.id_position })[0]?.name : payload?.selector?.id_position

        const msg = `Unconnected discord **${role}** from ` + (position ? `bridge scrims **${position}**.` : `any bridge scrims positions.`)
        return this.logging.sendLogMessages({ msg, ...payload }, "positions_log_channel", "Position Role Removed", '#F00A7D');

    }

    async onUserPositionRemove(payload) {

        const userPosition = new ScrimsUserPosition(this.database, payload?.userPosition || {})

        const msg = `Lost bridge scrims **${userPosition?.position?.name || userPosition?.id_position || 'unknown-position'}**.`
            + ` Because of ${await this.logging.getExecutorMention(payload.id_executor, payload.executor_id)} removing it.`

        return this.logging.sendLogMessages({ msg, ...payload, executor_id: undefined, id_executor: userPosition?.user?.id_user ?? null }, "positions_log_channel", "Position Taken", '#fc2360');

    }

    async onUserPositionCreate(userPositionData) {

        if (userPositionData?.position?.name === "bridge_scrims_member") return false;

        const userPosition = new ScrimsUserPosition(this.database, userPositionData)

        const msg = `Got bridge scrims **${userPosition?.position?.name || userPosition?.id_position || 'unknown-position'}** `
            + `${userPosition.getDuration()} from ${await this.logging.getExecutorMention(userPosition.id_executor)}.`

        return this.logging.sendLogMessages({ msg, executor_id: userPosition?.user?.discord_id ?? null }, "positions_log_channel", "Position Given", '#23cf93');

    }

    async onUserPositionExpireUpdate(payload) {

        const userPosition = new ScrimsUserPosition(this.database, { ...payload.userPosition, expires_at: payload.expires_at })

        const msg = `Got their bridge scrims **${userPosition?.position?.name || userPosition?.id_position || 'unknown-position'}** `
            + `updated by ${await this.logging.getExecutorMention(null, payload.executor_id)} it will now last ${userPosition.getDuration()}.`
        
        return this.logging.sendLogMessages({ msg, executor_id: userPosition?.user?.discord_id ?? null }, "positions_log_channel", "Position Updated", '#237793');

    }

    async onPositionCreate(payload) {

        const position = new ScrimsPosition(this.database, payload.position)

        const msg = `${this.logging.getExecutorMention(payload.id_executor)} created a new bridge scrims position called **${position.name}** `
            + `with a level of \`${position.level}\` in the hierarchy and a sticky value of \`${position.sticky}\`. `
        
        return this.logging.sendLogMessages({ msg, id_executor: payload.id_executor ?? null }, "positions_log_channel", "Position Created", '#00FF00');

    }

    async onPositionRemove(payload) {

        const position = new ScrimsPosition(this.database, payload.position)

        const msg = `${this.logging.getExecutorMention(payload.id_executor)} removed a bridge scrims position called **${position.name}** `
            + `with a level of \`${position.level}\` in the hierarchy and a sticky value of \`${position.sticky}\`. `
        
        return this.logging.sendLogMessages({ msg, id_executor: payload.id_executor ?? null }, "positions_log_channel", "Position Removed", '#FF0000');

    }

    async onJoinedRolesReceived(payload) {

        const roles = payload.roles.map(role => `**${((role?.name) ? `@${role.name}` : `${role}`)}**`)
        const msg = `Received ${roles.join(", ")} discord role(s) after joining the server.`
        return this.logging.sendLogMessages({ msg, ...payload }, "positions_log_channel", "Roles Received", '#FFE633');

    }

    async onPositionRolesReceived(payload) {

        const position = this.database.positions.cache.get({ id_position: payload.id_position })[0]?.name ?? "unknown-position"
        const roles = payload.roles.map(role => `**${((role?.name) ? `@${role.name}` : `${role}`)}**`)
        const msg = `Received ${roles.join(", ")} discord role(s) because of their **${position}** bridge scrims position.`
        return this.logging.sendLogMessages({ msg, ...payload }, "positions_log_channel", "Roles Received", '#7800E0');

    }

    async onPositionRolesLost(payload) {

        const position = this.database.positions.cache.get({ id_position: payload.id_position })[0]?.name ?? "unknown-position"
        const roles = payload.roles.map(role => `**${((role?.name) ? `@${role.name}` : `${role}`)}**`)
        const msg = `Lost ${roles.join(", ")} discord role(s) because of losing their **${position}** bridge scrims position.`
        return this.logging.sendLogMessages({ msg, ...payload }, "positions_log_channel", "Roles Lost", '#EB00A4');

    }

}

module.exports = PositionLoggingFeature