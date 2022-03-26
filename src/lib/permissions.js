
/**
 * **Definitions:**
 *  - `position:` A string identifier of a certain role you can have in bridge scrims e.g. developer or prime
 *  - `role:` A discord role id in form of a string
 *  - `hierarchy:` A list of positions with a level ordered by their level e.g. [owner, ..., support, ...]
 *  - `positionRoles:` The discord role(s) that indicate that a permissible has a position
 *  - `permissionLevel:` A position except positions higher in the hierarchy also are used as indicaters hat a permissible has a position
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

        return this.database.positions.cache.get({ }).filter(v => typeof v?.level === "number").sort((a, b) => a.level - b.level).map(v => v.name);
    
    }


    /**
     * 
     * @param { String } guildId
     * @returns { PositionRole[] } All the position roles in the guild.
     */
    getGuildPositionRoles(guildId) {
        return this.database.positionRoles.cache.get({ id_guild: guildId })
    }



    /**
     * 
     * @param { String } guildId
     * @param { String | int } positionResolvable Either the position name or the position id
     * @returns { String[] } The discord role ids that are required for the position
     */
    getPositionRequiredRoles(guildId, positionResolvable) {
        return this.getGuildPositionRoles(guildId).filter(p => (p.position.name == positionResolvable || p.id_position == positionResolvable)).map(p => p.id_role);
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
     * @returns { Boolean } If the permissible has the given permissionlevel **OR** higher **OR** all the given requiredPositions
     */
    hasPermission(permissible, permissionLevel, allowedPositions=[], requiredPositions=[]) {
        return this.hasRequiredPositions(permissible, requiredPositions) 
            && (this.hasPermissionLevel(permissible, permissionLevel) || this.hasAllowedPositions(permissible, allowedPositions));
    }


    /**
     * 
     * @param  { GuildMember | Role } permissible
     * @param  { String } requiredPosition
     * @returns { Boolean } If the permissible has the requiredPosition according to the database
     */
    hasRequiredPosition(permissible, requiredPosition) {

        // If the user has the position according to the scrims database
        const userPositions = this.database.userPositions.cache.get({ user: { discord_id: permissible.id } })
        if (userPositions.filter(userPos => userPos.position.name == requiredPosition || userPos.id_position == requiredPosition).length > 0) return true;

        return false;
    }


    /**
     * 
     * @param  { GuildMember | Role } permissible
     * @param  { String } requiredPosition
     * @returns { Boolean } If the permissible has the requiredPosition according to their discord roles
     */
    hasRequiredPositionRoles(permissible, requiredPosition) {

        // If the user has the required discord roles for the position
        const requiredRoles = this.getPositionRequiredRoles(permissible.guild.id, requiredPosition) 
        if (requiredRoles.every(roleId => permissible?.roles?.cache?.has(roleId))) return true;
       
        return false;
    }


    /**
     * 
     * @param  { GuildMember | Role } permissible
     * @param  { String[] } requiredPositions
     * @returns { Boolean } If the permissible has all the requiredPositions
     */
    hasRequiredPositions(permissible, requiredPositions) {
        return requiredPositions.every(position => this.hasRequiredPosition(permissible, position))
    }

    /**
     * 
     * @param  { GuildMember | Role } permissible
     * @param  { String[] } allowedPositions
     * @returns { Boolean } If the permissible has any of the allowedPositions
     */
    hasAllowedPositions(permissible, allowedPositions) {
        return allowedPositions.some(position => this.hasRequiredPosition(permissible, position))
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
     * @return { Boolean } If the permissible has the permissionLevel
     */
    hasPermissionLevel(permissible, permissionLevel) {
        const allowedPositions = this.getPermissionLevelPositions(permissionLevel)
        return this.hasAllowedPositions(permissible, allowedPositions);
    }


}

module.exports = ScrimsPermissionsClient;