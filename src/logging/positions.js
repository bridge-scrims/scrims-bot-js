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
        this.database.ipc.on('scrims_user_position_create', message => this.onUserPositionCreate(message.payload).catch(console.error))
        this.database.ipc.on('scrims_user_position_expire', message => this.onUserPositionExpire(message.payload).catch(console.error))
        
        this.database.ipc.on('audited_position_create', message => this.onPositionCreate(message.payload).catch(console.error))
        this.database.ipc.on('audited_position_remove', message => this.onPositionRemove(message.payload).catch(console.error))
        this.database.ipc.on('audited_position_update', message => this.onPositionUpdate(message.payload).catch(console.error))
        
        this.database.ipc.on('joined_discord_roles_received', message => this.onJoinedRolesReceived(message.payload).catch(console.error))
        this.database.ipc.on('position_discord_roles_received', message => this.onPositionRolesReceived(message.payload).catch(console.error))
        this.database.ipc.on('position_discord_roles_lost', message => this.onPositionRolesLost(message.payload).catch(console.error))
        this.database.ipc.on('position_discord_roles_lost_expired', message => this.onPositionRolesLostExpired(message.payload).catch(console.error))
        
    }

    async onPositionsError(payload) {

        return this.logging.sendLogMessages(payload, "positions_log_channel", "Positions Error", '#D3011C');

    }

    async onPositionRoleCreate(payload) {

        if (!payload.positionRole) {

            const msg = `Created an unknown new positions role.`
            return this.logging.sendLogMessages({ msg, ...payload }, "guild_positions_log_channel", "Position Role Created", '#0098EB');

        }

        const positionRole = new ScrimsPositionRole(this.database, payload.positionRole)
        const role = positionRole.role ? `${positionRole.role}` : positionRole.role_id
        const position = positionRole.position?.name ?? positionRole.id_position

        const msg = `Connected discord **${role}** to bridge scrims **${position}**.`
        return this.logging.sendLogMessages({ msg, ...payload }, "guild_positions_log_channel", "Position Role Created", '#0098EB', [positionRole.guild_id]);

    }

    async onPositionRoleRemove(payload) {

        const guild = payload?.selector?.guild_id ? (this.database.guilds.cache.resolve(payload.selector.guild_id)?.discordGuild ?? null) : null
        const role = (guild && guild.roles.resolve(payload?.selector?.role_id)) ? `${guild.roles.resolve(payload.selector.role_id)}` : `**@${payload?.selector?.role_id}**`

        const position = (payload?.selector?.id_position) ? this.database.positions.cache.resolve(payload.selector.id_position)?.name : payload?.selector?.id_position

        const msg = `Unconnected discord ${role} from ` + (position ? `bridge scrims **${position}**.` : `any bridge scrims positions.`)
        return this.logging.sendLogMessages({ msg, ...payload }, "guild_positions_log_channel", "Position Role Removed", '#F00A7D', [payload?.selector?.guild_id]);

    }

    async onUserPositionRemove(payload) {

        const userPosition = new ScrimsUserPosition(this.database, payload?.userPosition || {})
        if (userPosition?.position?.dontLog) return false;

        const executor = this.logging.getUser(payload.id_executor, payload.executor_id)

        const msg = `Lost bridge scrims **${userPosition?.position?.name || userPosition?.id_position || 'unknown-position'}**, `
            + `because of ${(executor?.getMention('**') ?? 'an **unknown-user**')} removing it.`

        return this.logging.sendLogMessages(
            { msg, ...payload, mentions: [executor?.discordUser], executor_id: undefined, id_executor: userPosition?.user?.id_user ?? null }, 
            "positions_log_channel", "Position Taken", '#fc2360'
        );

    }

    async onUserPositionExpire(userPositionData) {

        const userPosition = new ScrimsUserPosition(this.database, userPositionData)
        if (userPosition?.position?.dontLog) return false;

        const msg = `Lost bridge scrims **${userPosition?.position?.name || userPosition?.id_position || 'unknown-position'}**, because of it expiring.`
        return this.logging.sendLogMessages({ msg, id_executor: userPosition?.user?.id_user ?? null }, "positions_log_channel", "Position Expired", '#643cd3');

    }

    async onUserPositionCreate(userPositionData) {

        const userPosition = new ScrimsUserPosition(this.database, userPositionData)
        if (userPosition?.position?.dontLog) return false;

        const msg = `Got bridge scrims **${userPosition?.position?.name || userPosition?.id_position || 'unknown-position'}** `
            + `${userPosition.getDuration()} from ${(userPosition?.executor?.getMention('**') ?? 'an **unknown-user**')}.`

        return this.logging.sendLogMessages(
            { msg, mentions: [userPosition?.executor?.discordUser], executor_id: userPosition?.user?.discord_id ?? null }, 
            "positions_log_channel", "Position Given", '#23cf93'
        );

    }

    async onUserPositionExpireUpdate(payload) {

        const userPosition = new ScrimsUserPosition(this.database, { ...payload.userPosition, expires_at: payload.expires_at })
        const executor = this.logging.getUser(payload.id_executor, payload.executor_id)

        const msg = `Got their bridge scrims **${userPosition?.position?.name || userPosition?.id_position || 'unknown-position'}** `
            + `updated by ${(executor?.getMention('**') ?? 'an **unknown-user**')} it will now last ${userPosition.getDuration()}.`
        
        return this.logging.sendLogMessages({ msg, mentions: [executor?.discordUser], executor_id: userPosition?.user?.discord_id ?? null }, "positions_log_channel", "Position Updated", '#5dfee3');

    }

    async onPositionCreate(payload) {

        const position = new ScrimsPosition(this.database, payload.position)
 
        const msg = `Created a new bridge scrims position called **${position.name}** `
            + `with a level of \`${position.level}\` in the hierarchy and a sticky value of \`${position.sticky}\`. `
        
        return this.logging.sendLogMessages({ msg, id_executor: payload.id_executor ?? null }, "positions_log_channel", "Position Created", '#00FF00');

    }

    async onPositionRemove(payload) {

        const position = new ScrimsPosition(this.database, payload.position)

        const msg = `Removed a bridge scrims position called **${position.name}** `
            + `with a level of \`${position.level}\` in the hierarchy and a sticky value of \`${position.sticky}\`. `
        
        return this.logging.sendLogMessages({ msg, id_executor: payload.id_executor ?? null }, "positions_log_channel", "Position Removed", '#FF0000');

    }

    async onPositionUpdate(payload) {

        const position = new ScrimsPosition(this.database, payload.position)
        const userPositions = await this.database.userPositions.count({ id_position: position.id_position }, false)
        const msg = `Updated the position called **${position.name}** that is owned by \`${userPositions}\` **member(s)**.`
        
        return this.logging.sendLogMessages({ msg, id_executor: payload.id_executor ?? null, oldValue: position, update: payload.update }, "positions_log_channel", "Position Updated", '#ff9a51');

    }

    async onJoinedRolesReceived(payload) {

        const roles = payload.roles
        const msg = `Received ${roles.join(" ")} discord role(s) after joining the server.`
        return this.logging.sendLogMessages({ msg, ...payload }, "guild_positions_log_channel", "Roles Received", '#FFE633', [payload.guild_id]);

    }

    async onPositionRolesReceived(payload) {

        const guild = this.bot.guilds.resolve(payload.guild_id)
        const userPosition = new ScrimsUserPosition(this.database, payload.userPosition)
        const position = (userPosition?.position?.name ?? "unknown-position")
        const expiration = (userPosition.expires_at ? ` ${userPosition.getDuration()}` : "")
        const msg = `Received ${payload.roles.join(" ")} discord role(s)${expiration} from ${userPosition.getExecutorMention("**", guild)} giving them **${position}** position.`
        return this.logging.sendLogMessages({ msg, mentions: [userPosition.executor], ...payload }, "guild_positions_log_channel", "Roles Received", '#9387ff', [payload.guild_id]);

    }

    async onPositionRolesLost(payload) {

        const guild = this.bot.guilds.resolve(payload.guild_id)
        const remover = this.logging.getUser(payload.remover.id_user, payload.remover.discord_id)
        const userPosition = new ScrimsUserPosition(this.database, payload.userPosition)
        const position = (userPosition?.position?.name ?? "unknown-position")
        const msg = `Lost ${payload.roles.join(" ")} discord role(s) because of ${remover?.getMention("**", guild) ?? "an unknown-user"} taking their **${position}** position.`
        return this.logging.sendLogMessages({ msg, mentions: [remover], ...payload }, "guild_positions_log_channel", "Roles Lost", '#ec8cff', [payload.guild_id]);

    }

    async onPositionRolesLostExpired(payload) {

        const userPosition = new ScrimsUserPosition(this.database, payload.userPosition)
        const position = (userPosition?.position?.name ?? "unknown-position")
        const msg = `Lost ${payload.roles.join(" ")} discord role(s) because of their **${position}** position expiring.`
        return this.logging.sendLogMessages({ msg, ...payload }, "guild_positions_log_channel", "Roles Expired", '#8ad2ff', [payload.guild_id]);

    }

}

module.exports = PositionLoggingFeature