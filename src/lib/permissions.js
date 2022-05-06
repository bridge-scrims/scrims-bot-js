const { validate: validateUUID } = require('uuid');

/**
 * **Definitions:**
 *  - `position:` A string identifier of a certain role you can have in bridge scrims e.g. developer or prime
 *  - `role:` A discord role id in form of a string
 *  - `hierarchy:` A list of positions with a level ordered by their level e.g. [owner, ..., support, ...]
 *  - `positionRoles:` The discord role(s) that indicate that a permissible has a position
 *  - `permissionLevel:` A position except positions higher in the hierarchy also are used as indicaters that a permissible has a position
 */
class ScrimsPermissionsClient {
    
    /**
     * 
     * @param { DBClient } database 
     */
    constructor(database) {

        this.database = database

    }


    get hierarchy() {

        return this.database.positions.cache.values().filter(v => typeof v?.level === "number").sort((a, b) => a.level - b.level).map(v => v.name);
    
    }


    /**
     * 
     * @param { String } guildId
     * @returns { PositionRole[] } All the position roles in the guild.
     */
    getGuildPositionRoles(guildId) {

<<<<<<< HEAD
        return this.database.positionRoles.cache.find({ guild_id });
=======
        return this.database.positionRoles.cache.get({ guild: { discord_id: guildId } });
>>>>>>> main
        
    }

    
    /**
     * 
     * @param { String } guildId
     * @param { String | Integer } positionResolvable Either the position name or the position id
     * @returns { String[] } The discord role ids that are required for the position
     */
    getPositionRequiredRoles(guildId, positionResolvable) {

        return this.getGuildPositionRoles(guildId).filter(p => (p.position.name === positionResolvable || p.id_position === positionResolvable)).map(p => p.role_id);
    
    }


    /**
     * 
     * @param  { { permissionLevel: ?String, allowedPositions: ?String[], requiredPositions: ?String[] } } cmd
     * @returns  { String[] } The positions that have permission to run the command
     */
    getCommandAllowedPositions(cmd) {

        const permissionLevelRoles = (cmd?.permissionLevel ? this.getPermissionLevelPositions(cmd.permissionLevel) : [])
        return permissionLevelRoles.concat(cmd?.allowedPositions || []).concat(cmd?.requiredPositions || []);

    }


    /**
     * 
     * @param  { GuildMember | Role } permissible
     * @param  { String } permissionLevel
     * @param  { String[] } allowedPositions Positions that alone will give permission (or)
     * @param  { String[] } requiredPositions Positions that are all required for permission (and)
     * @returns { Promise<Boolean> } If the permissible has the given permissionlevel **OR** higher **OR** all the given requiredPositions
     */
    async hasPermission(permissible, permissionLevel, allowedPositions=[], requiredPositions=[]) {

        const hasRequiredPositions = await this.hasRequiredPositions(permissible, requiredPositions)
        const hasPermissionLevel = await this.hasPermissionLevel(permissible, permissionLevel)
        const hasAllowedPositions = await this.hasAllowedPositions(permissible, allowedPositions)
        
        return hasRequiredPositions && (hasPermissionLevel || hasAllowedPositions);

    }


    /**
     * 
     * @param  { GuildMember | Role } permissible
     * @param  { String | Integer } positionResolvable
     * @returns { Promise<Boolean> } If the permissible has the requiredPosition according to the database
     */
    async hasRequiredPosition(permissible, positionResolvable) {

        const positionSelector = (validateUUID(positionResolvable)) ? { id_position: positionResolvable } : { position: { name: positionResolvable } };
        const userPositions = this.database.userPositions.cache.find({ user: { discord_id: permissible.id }, ...positionSelector })
        
        return (userPositions.length > 0 && this.hasRequiredPositionRoles(permissible, positionResolvable));

    }


    /**
     * 
     * @param  { GuildMember | Role } permissible
     * @param  { String | Integer } positionResolvable
     * @param  { Boolean } allowNone
     * @returns { Boolean } If the permissible has the positionResolvable according to their discord roles
     */
    hasRequiredPositionRoles(permissible, positionResolvable, allowNone=true) {

        // If the user has the required discord roles for the position
        const requiredRoles = this.getPositionRequiredRoles(permissible.guild.id, positionResolvable) 
        if (requiredRoles.length === 0) return allowNone;

        return (requiredRoles.some(roleId => permissible?.roles?.cache?.has(roleId)));

    }


    /**
     * 
     * @param  { GuildMember | Role } permissible
     * @param  { String[] } requiredPositions
     * @returns { Promise<Boolean> } If the permissible has all the requiredPositions
     */
    async hasRequiredPositions(permissible, requiredPositions) {

        return Promise.all(requiredPositions.map(position => this.hasRequiredPosition(permissible, position))).then(results => results.every(v => v));

    }

    /**
     * 
     * @param  { GuildMember | Role } permissible
     * @param  { String[] } allowedPositions
     * @returns { Promise<Boolean> } If the permissible has any of the allowedPositions
     */
    async hasAllowedPositions(permissible, allowedPositions) {

        return Promise.all(allowedPositions.map(position => this.hasRequiredPosition(permissible, position))).then(results => results.some(v => v));

    }

    /**
     * 
     * @param  { String } permissionLevel
     * @return { String[] } Any positions that are above or at the permissionLevel in the scrims hierarchy
     */
    getPermissionLevelPositions(permissionLevel) {

        const requiredIndex = this.hierarchy.indexOf(permissionLevel)
        if (requiredIndex === -1) return [ permissionLevel ]; // Not in hierarchy so only that position gives you permission

        return this.hierarchy.slice(0, requiredIndex+1); // Removed all levels of the hierarchy below the required one

    }

    /**
     * 
     * @param  { GuildMember | Role } permissible
     * @param  { String } permissionLevel
     * @return { Promise<Boolean> } If the permissible has the permissionLevel
     */
    async hasPermissionLevel(permissible, permissionLevel) {

        const allowedPositions = this.getPermissionLevelPositions(permissionLevel)
        return this.hasAllowedPositions(permissible, allowedPositions);

    }


}

module.exports = ScrimsPermissionsClient;