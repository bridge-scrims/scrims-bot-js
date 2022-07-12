const ScrimsUserPositionsCollection = require('./scrims/user_positions');
const ScrimsPositionRole = require('./scrims/position_role');
const ScrimsPosition = require('./scrims/position');
const { GuildMember } = require('discord.js');

/**
 * Manages the permissions of `GuildMembers`, unlike the `ScrimsUserPositionsCollection` that manages the permissions of a `ScrimsUser`.
 * Different to the **hasPossition** of `ScrimsUserPositionsCollection` the **hasPosition** of this will also ensure the member has the 
 * required position's roles (defined by `positionRoles`) and can check for discord permissions.
 * 
 * **Definitions:**
 *  - `position:` The bridge scrims version of discord roles e.g. developer or prime
 *  - `role:` Discord roles
 *  - `hierarchy:` Since positions can have a level they can form a hierarchy e.g. owner is above staff
 *  - `positionRoles:` The discord role(s) that indicate that a member has a position
 *  - `positionLevel:` Resolvable of a position in the hierarchy, where positions above will also have permissions
 */
class ScrimsPermissionsClient {
    
    /**
     * @param {import('./postgresql/database')} database 
     */
    constructor(database) {

        /** @type {import('./postgresql/database')} */
        this.database = database

    }


    get positions() {

        return this.database.positions.cache.values();
    
    }

    /**
     * @param {import('../types').PositionResolvable} positionResolvable
     */
    resolvePosition(positionResolvable) {

        return this.database.positions.cache.filter(v => v === positionResolvable || v.id_position === positionResolvable || v.name === positionResolvable)[0] ?? null;

    }

    /**
     * @param {string} guild_id
     * @returns {ScrimsPositionRole[]} All the position roles in the guild.
     */
    getGuildPositionRoles(guild_id) {

        return this.database.positionRoles.cache.get({ guild_id });
        
    }

    /**
     * @param {string} guildId
     * @param {string|number|ScrimsPosition} positionResolvable Either the position name, id or the position itself
     * @returns {ScrimsPositionRole[]}
     */
    getPositionRequiredPositionRoles(guildId, positionResolvable) {

        return this.getGuildPositionRoles(guildId).filter(p => (p.position === positionResolvable || p.position.name === positionResolvable || p.id_position === positionResolvable));
    
    }

    /**
     * @param {string} guildId
     * @param {string|number|ScrimsPosition} positionResolvable Either the position name, id or the position itself
     * @returns {string[]} The discord role ids that are required for the position
     */
    getPositionRequiredRoles(guildId, positionResolvable) {

        return this.getPositionRequiredPositionRoles(guildId, positionResolvable).map(p => p.role_id);
    
    }

    /**
     * @param {string} guildId
     * @param {import('discord.js').RoleResolvable} roleResolvable
     */
    getRoleRequiredPositions(guildId, roleResolvable) {

        return this.getGuildPositionRoles(guildId).filter(p => (p.role === roleResolvable || p.role_id === roleResolvable)).map(p => p.position);
    
    }


    /**
     * @param  {{ positionLevel: ?String, allowedPositions: ?String[], requiredPositions: ?String[] }} cmd
     * @returns  {string[]} The positions that have permission to run the command
     */
    getCommandAllowedPositions(cmd) {

        return [];
        // eslint-disable-next-line no-unreachable
        const permissionLevelRoles = (cmd?.positionLevel ? this.getPositionLevelPositions(cmd.positionLevel) : [])
        return permissionLevelRoles.concat(cmd?.allowedPositions || []).concat(cmd?.requiredPositions || []);

    }
    
    /**
     * @param {ScrimsUserPositionsCollection|null} userPositions 
     * @param {import("./types").ScrimsGuildMember|string|null} member
     * @param {import("./types").ScrimsPermissions} permissions
     */
    hasPermission(userPositions, member, permissions) {

        if (!userPositions && !member) return false;
        
        const hasRequiredRoles = this.hasRequiredRoles(member, permissions.requiredRoles ?? [])
        const hasRequiredPermissions = this.hasRequiredPermissions(member, permissions.requiredPermissions ?? [])
        const hasRequiredPositions = this.hasRequiredPositions(member, permissions.requiredPositions ?? [], userPositions)
        
        const hasPositionLevel = this.hasPositionLevel(member, permissions.positionLevel ?? null, userPositions)
        const hasAllowedPositions = this.hasAllowedPositions(member, permissions.allowedPositions ?? [], userPositions)
        const hasAllowedPermissions = this.hasAllowedPermissions(member, permissions.allowedPermissions ?? [])
        const hasAllowedRoles = this.hasAllowedRoles(member, permissions.allowedRoles ?? [])
        const hasAllowedUsers = this.hasAllowedUsers(member, permissions.allowedUsers ?? [], userPositions)
        
        const allowed = [hasPositionLevel, hasAllowedPositions, hasAllowedPermissions, hasAllowedRoles, hasAllowedUsers]
        return hasRequiredRoles && hasRequiredPermissions && hasRequiredPositions && (allowed.every(v => v === null) || allowed.some(v => v === true));

    }

    /**
     * @param {import("./types").ScrimsGuildMember|string|null} member
     * @param {import('discord.js').RoleResolvable[]} roles
     */
    hasRequiredRoles(member, roles) {

        return roles.every(role => !member || member.roles.cache.has(member.roles.resolveId(role)));

    }

    /**
     * @param {import("./types").ScrimsGuildMember|string|null} member
     * @param {import('discord.js').RoleResolvable[]} roles
     */
    hasAllowedRoles(member, roles) {

        if (roles.length === 0) return null;
        return roles.some(role => !member || member.roles.cache.has(member.roles.resolveId(role)));

    }

    /**
     * @param {import("./types").ScrimsGuildMember|string|null} member
     * @param {string[]} allowedUsers
     * @param {ScrimsUserPositionsCollection|null} userPositions 
     */
    hasAllowedUsers(member, allowedUsers, userPositions) {

        if (allowedUsers.length === 0) return null;
        return allowedUsers.includes(member?.id) || allowedUsers.includes(userPositions?.user?.discord_id);

    }

    /**
     * @param {import("./types").ScrimsGuildMember|string|null} member
     * @param {import('discord.js').PermissionResolvable[]} permissions
     */
    hasRequiredPermissions(member, permissions) {

        return permissions.every(perm => !member || member.permissions.has(perm, true));

    }

    /**
     * @param {import("./types").ScrimsGuildMember|null} member
     * @param {import('discord.js').PermissionResolvable[]} permissions
     */
    hasAllowedPermissions(member, permissions) {

        if (permissions.length === 0) return null;
        return permissions.some(perm => !member || member.permissions.has(perm, true));

    }

    /**
     * @param {import("./types").ScrimsGuildMember|null} member
     * @param {import('./types').PositionResolvable} positionResolvable
     * @param {ScrimsUserPositionsCollection} userPositions 
     */
    hasPosition(member, positionResolvable, userPositions) {

        if (!userPositions && !member) return false;
        return (!userPositions || userPositions.hasPosition(positionResolvable)) && (!member || this.hasRequiredPositionRoles(member, positionResolvable, true));

    }

    /**
     * @param {GuildMember} member
     * @param {import('./types').PositionResolvable} positionResolvable Either the position name, id or the position itself
     * @param {boolean} [allowNone]
     */
    hasRequiredPositionRoles(member, positionResolvable, allowNone=true) {

        // If the user has the required discord roles for the position
        const requiredRoles = this.getPositionRequiredRoles(member.guild.id, positionResolvable) 
        if (requiredRoles.length === 0) return allowNone;

        return (requiredRoles.some(roleId => member.roles.cache.has(roleId)));

    }

    /**
     * @param {GuildMember} member
     * @param {ScrimsUserPositionsCollection} userPositions
     * @param {import('discord.js').RoleResolvable} roleResolvable
     * @param {boolean} [allowNone]
     */
    hasRequiredRolesPositions(member, userPositions, roleResolvable, allowNone=true) {

        const positions = this.getRoleRequiredPositions(member.guild.id, roleResolvable) 
        if (positions.length === 0) return allowNone;

        if (userPositions.hasPosition("banned") && !(positions.find(pos => pos.name === "banned"))) return false;
        return (positions.some(pos => this.hasPosition(null, pos, userPositions)));

    }

    /**
     * @param {import("./types").ScrimsGuildMember} member
     * @param {import('./types').PositionResolvable[]} requiredPositions
     * @param {ScrimsUserPositionsCollection} userPositions 
     */
    hasRequiredPositions(member, requiredPositions, userPositions) {

        return requiredPositions.every(r => this.hasPosition(member, r, userPositions));

    }

    /**
     * @param {import("./types").ScrimsGuildMember} member
     * @param {import('./types').PositionResolvable[]} allowedPositions
     * @param {ScrimsUserPositionsCollection} userPositions 
     */
    hasAllowedPositions(member, allowedPositions, userPositions) {

        if (allowedPositions.length === 0) return null;
        return allowedPositions.some(r => this.hasPosition(member, r, userPositions));

    }

    /**
     * @param {import("./types").ScrimsGuildMember} member
     * @param {import("./types").PositionResolvable} positionLevel
     * @param {ScrimsUserPositionsCollection} userPositions 
     */
    hasPositionLevel(member, positionLevel, userPositions) {

        const position = this.resolvePosition(positionLevel)
        if (!position) return null;

        return this.hasAllowedPositions(member, position.getPositionLevelPositions(), userPositions);

    }


}

module.exports = ScrimsPermissionsClient;