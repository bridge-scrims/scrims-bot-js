const ScrimsPositionRole = require('./scrims/position_role');
const ScrimsUserPosition = require('./scrims/user_position');
const ScrimsPosition = require('./scrims/position');
const { GuildMember } = require('discord.js');
const ScrimsUserPositionsCollection = require('./scrims/user_positions');

/**
 * **Definitions:**
 *  - `position:` The bridge scrims version of discord roles e.g. developer or prime
 *  - `role:` Discord roles
 *  - `hierarchy:` Since positions can have a level they can form a hierarchy e.g. owner is above staff
 *  - `positionRoles:` The discord role(s) that indicate that a member has a position
 *  - `permissionLevel:` Name of a permission in the hierarchy, where positions above will also have permissions
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
     * @param {string} guild_id
     * @returns {PositionRole[]} All the position roles in the guild.
     */
    getGuildPositionRoles(guild_id) {

        return this.database.positionRoles.cache.get({ guild_id });
        
    }

    /**
     * @param {string} guildId
     * @param {string|number|ScrimsPosition} positionResolvable Either the position name, id or the position itself
     * @returns {ScrimsPositionRole[]} The discord role ids that are required for the position
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
     * @param  {{ permissionLevel: ?String, allowedPositions: ?String[], requiredPositions: ?String[] }} cmd
     * @returns  {string[]} The positions that have permission to run the command
     */
    getCommandAllowedPositions(cmd) {

        const permissionLevelRoles = (cmd?.permissionLevel ? this.getPermissionLevelPositions(cmd.permissionLevel) : [])
        return permissionLevelRoles.concat(cmd?.allowedPositions || []).concat(cmd?.requiredPositions || []);

    }
    
    /**
     * @param {ScrimsUserPositionsCollection} userPositions 
     * @param {import("./types").ScrimsGuildMember} member
     * @param {string} permissionLevel
     * @param {string[]} allowedPositions Positions that alone will give permission (or)
     * @param {string[]} requiredPositions Positions that are all required for permission (and)
     * @returns {boolean} If the permissible has the permissionlevel **OR** higher **OR** the allowedPositions **AND** all the requiredPositions
     */
    hasPermission(userPositions, member, permissionLevel, allowedPositions=[], requiredPositions=[]) {

        if (!member.scrimsUser) return false;

        const hasRequiredPositions = this.hasRequiredPositions(member, requiredPositions, userPositions)
        const hasPermissionLevel = this.hasPermissionLevel(member, permissionLevel, userPositions)
        const hasAllowedPositions = this.hasAllowedPositions(member, allowedPositions, userPositions)
        
        return hasRequiredPositions && (hasPermissionLevel || hasAllowedPositions);

    }

    /**
     * @param {import("./types").ScrimsGuildMember} member
     * @param {import('./types').PositionResolvable} positionResolvable
     * @param {ScrimsUserPositionsCollection} userPositions 
     */
    hasRequiredPosition(member, positionResolvable, userPositions) {

        return userPositions.hasPosition(positionResolvable) && this.hasRequiredPositionRoles(member, positionResolvable, true);

    }

    /**
     * @param {GuildMember} member
     * @param {import('./types').PositionResolvable} positionResolvable Either the position name, id or the position itself
     * @param {boolean} allowNone
     */
    hasRequiredPositionRoles(member, positionResolvable, allowNone=true) {

        // If the user has the required discord roles for the position
        const requiredRoles = this.getPositionRequiredRoles(member.guild.id, positionResolvable) 
        if (requiredRoles.length === 0) return allowNone;

        return (requiredRoles.some(roleId => member.roles.cache.has(roleId)));

    }

    /**
     * @param {import("./types").ScrimsGuildMember} member
     * @param {import('./types').PositionResolvable[]} requiredPositions
     * @param {ScrimsUserPositionsCollection} userPositions 
     */
    hasRequiredPositions(member, requiredPositions, userPositions) {

        return requiredPositions.map(r => this.hasRequiredPosition(member, r, userPositions)).every(v => v);

    }

    /**
     * @param {import("./types").ScrimsGuildMember} member
     * @param {import('./types').PositionResolvable[]} allowedPositions
     * @param {ScrimsUserPositionsCollection} userPositions 
     */
    hasAllowedPositions(member, allowedPositions, userPositions) {

        if (allowedPositions.length === 0) return false;
        return allowedPositions.map(r => this.hasRequiredPosition(member, r, userPositions)).some(v => v);

    }

    /**
     * @param {string} permissionLevel
     * @return {string[]} Any positions that are above or at the permissionLevel in the scrims hierarchy
     */
    getPermissionLevelPositions(permissionLevel) {

        const position = this.positions.filter(pos => pos.name === permissionLevel)[0]
        if (!position) return []
        return position.getPermissionLevelPositions().map(pos => pos.name);

    }

    /**
     * @param {import("./types").ScrimsGuildMember} member
     * @param {string} permissionLevel
     * @param {ScrimsUserPositionsCollection} userPositions 
     */
    hasPermissionLevel(member, permissionLevel, userPositions) {

        const allowedPositions = this.getPermissionLevelPositions(permissionLevel)
        return this.hasAllowedPositions(member, allowedPositions, userPositions);

    }


}

module.exports = ScrimsPermissionsClient;