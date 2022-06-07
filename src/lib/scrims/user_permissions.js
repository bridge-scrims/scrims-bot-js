const ScrimsUserPosition = require("./user_position");
const ScrimsUser = require("./user");
const { Guild } = require("discord.js");

class ScrimsUserPermissionsManager {

    constructor(user) {

        /** @type {ScrimsUser} */
        this.user = user

    }
    
    get bot() {

        return this.user.bot;

    }

    get client() {

        return this.user.client;

    }

    /**
     * @param {import('../types').PositionResolvable} positionResolvable
     */
    resolvePosition(positionResolvable) {

        return this.client.positions.cache.filter(v => v === positionResolvable || v.id_position === positionResolvable || v.name === positionResolvable)[0] ?? null;

    }

    /**
     * @param {import('../types').PositionResolvable} positionResolvable
     */
    resolvePositionId(positionResolvable) {

        return this.resolvePosition(positionResolvable)?.id_position ?? null;

    }

    /**
     * @param {ScrimsUserPosition[]|Object.<string, ScrimsUserPosition[]>} userPositions 
     */
    getUserPositions(userPositions=[]) {

        if (userPositions instanceof Array) userPositions = userPositions.filter(v => v.id_user === this.user.id_user);
        else userPositions = (userPositions[this.user.id_user] ?? []);

        return Object.fromEntries(userPositions.map(userPos => [userPos.id_position, userPos]));

    }

    /**
     * @param {import('../types').PositionResolvable} positionResolvable
     * @param {ScrimsUserPosition[]|Object.<string, ScrimsUserPosition[]>} userPositions
     * @returns {ScrimsUserPosition|false} 
     */
    hasPosition(positionResolvable, userPositions) {

        const id_position = this.resolvePositionId(positionResolvable)
        if (!id_position) return false;

        return this.getUserPositions(userPositions)[id_position] ?? false;

    }

    /**
     * @param {import('../types').PositionResolvable} positionResolvable
     * @returns {Promise<ScrimsUserPosition|false>} 
     */
    async fetchHasPosition(positionResolvable) {

        const id_position = this.resolvePositionId(positionResolvable)
        if (!id_position) return false;

        return this.client.userPositions.find({ id_user: this.id_user, id_position }).then(v => v ?? false);

    }

    /**
     * @param {import('../types').PositionResolvable[]} positionResolvables
     * @param {ScrimsUserPosition[]|Object.<string, ScrimsUserPosition[]>} userPositions 
     */
    hasEveryPosition(positionResolvables, userPositions) {

        return positionResolvables.map(r => this.hasPosition(r, userPositions)).every(v => v);

    }

    /**
     * @param {import('../types').PositionResolvable[]} positionResolvables
     * @param {ScrimsUserPosition[]|Object.<string, ScrimsUserPosition[]>} userPositions 
     */
    hasSomePositions(positionResolvables, userPositions) {

        return positionResolvables.map(r => this.hasPosition(r, userPositions)).some(v => v);

    }

    /**
     * @param {ScrimsUserPosition[]|Object.<string, ScrimsUserPosition[]>} userPositions 
     * @param {string} permissionLevel
     * @param {string[]} allowedPositions Positions that alone will give permission (or)
     * @param {string[]} requiredPositions Positions that are all required for permission (and)
     * @returns {boolean} If the permissible has the permissionlevel **OR** higher **OR** the allowedPositions **AND** all the requiredPositions
     */
    hasPermission(userPositions, permissionLevel, allowedPositions, requiredPositions) {

        const hasRequiredPositions = this.hasEveryPosition(requiredPositions ?? [], userPositions)
        const hasPermissionLevel = this.hasPermissionLevel(permissionLevel, userPositions)
        const hasAllowedPositions = this.hasSomePositions(allowedPositions ?? [], userPositions)
        
        return hasRequiredPositions && (hasPermissionLevel || hasAllowedPositions);

    }

    /**
     * @param {Guild} guild
     * @param {ScrimsUserPosition[]|Object.<string, ScrimsUserPosition[]>} userPositions 
     * @param {string} permissionLevel
     * @param {string[]} allowedPositions Positions that alone will give permission (or)
     * @param {string[]} requiredPositions Positions that are all required for permission (and)
     * @returns {boolean} If the permissible has the permissionlevel **OR** higher **OR** the allowedPositions **AND** all the requiredPositions
     */
    hasGuildPermission(guild, userPositions, permissionLevel, allowedPositions, requiredPositions) {

        if (!this.user.discord_id) return false;

        const member = guild.members.cache.get(this.user.discord_id)
        if (!member) return false;

        return this.bot.permissions.hasPermission(member, userPositions, permissionLevel, allowedPositions, requiredPositions);

    }

    /**
     * @param {Guild} guild
     * @param {string} permissionLevel
     * @param {string[]} allowedPositions Positions that alone will give permission (or)
     * @param {string[]} requiredPositions Positions that are all required for permission (and)
     * @returns {Promise<boolean>} If the permissible has the permissionlevel **OR** higher **OR** the allowedPositions **AND** all the requiredPositions
     */
    async fetchHasGuildPermission(guild, permissionLevel, allowedPositions, requiredPositions) {

        if (!this.user.discord_id) return false;

        const member = await guild.members.fetch(this.user.discord_id)
        if (!member) return false;

        const userPositions = await this.fetchPositions()

        return this.bot.permissions.hasPermission(member, Object.values(userPositions), permissionLevel, allowedPositions, requiredPositions);

    }

    /**
     * @param {import('../types').PositionResolvable} permissionLevel
     * @param {ScrimsUserPosition[]|Object.<string, ScrimsUserPosition[]>} userPositions
     */
    hasPermissionLevel(permissionLevel, userPositions) {

        const position = this.resolvePosition(permissionLevel)
        if (!position) return false;

        return this.hasSomePositions(position.getPermissionLevelPositions(), userPositions)

    }

    async fetchPositions() {

        const userPositions = await this.client.userPositions.fetch({ id_user: this.user.id_user }, false)
        return Object.fromEntries(userPositions.map(userPos => [userPos.id_position, userPos]));

    }

    toJSON() {

        return undefined;

    }

}

module.exports = ScrimsUserPermissionsManager;