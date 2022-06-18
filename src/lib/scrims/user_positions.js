const ScrimsUserPosition = require("./user_position");
const ScrimsUser = require("./user");
const { Guild } = require("discord.js");

class ScrimsUserPositionsCollection {

    constructor(user) {

        /** @type {ScrimsUser} */
        this.user = user

        /** @type {Object.<string, ScrimsUserPosition>} */
        this.userPositions

    }
    
    get bot() {

        return this.user.bot;

    }

    get client() {

        return this.user.client;

    }

    getUserPositions() {

        return Object.values(this.userPositions);

    }

    getPositions() {

        return Object.values(this.userPositions).map(userPos => userPos.position).filter(v => v);
        
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
    setPositions(userPositions=[]) {

        if (userPositions instanceof Array) userPositions = userPositions.filter(v => v.id_user === this.user.id_user);
        else userPositions = (userPositions[this.user.id_user] ?? []);
        
        this.userPositions = Object.fromEntries(userPositions.map(userPos => [userPos.id_position, userPos]));
        return this;

    }

    /**
     * @param {import('../types').PositionResolvable} positionResolvable
     * @returns {ScrimsUserPosition|false} 
     */
    hasPosition(positionResolvable) {

        const id_position = this.resolvePositionId(positionResolvable)
        if (!id_position) return false;

        return this.userPositions[id_position] ?? false;

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
     */
    hasEveryPosition(positionResolvables) {

        return positionResolvables.map(r => this.hasPosition(r)).every(v => v);

    }

    /**
     * @param {import('../types').PositionResolvable[]} positionResolvables
     */
    hasSomePositions(positionResolvables) {

        return positionResolvables.map(r => this.hasPosition(r)).some(v => v);

    }

    /**
     * @param {string} permissionLevel
     * @param {string[]} allowedPositions Positions that alone will give permission (or)
     * @param {string[]} requiredPositions Positions that are all required for permission (and)
     * @returns {boolean} If the permissible has the permissionlevel **OR** higher **OR** the allowedPositions **AND** all the requiredPositions
     */
    hasPermission(permissionLevel, allowedPositions, requiredPositions) {

        const hasRequiredPositions = this.hasEveryPosition(requiredPositions ?? [])
        const hasPermissionLevel = this.hasPermissionLevel(permissionLevel)
        const hasAllowedPositions = this.hasSomePositions(allowedPositions ?? [])
        
        return hasRequiredPositions && (hasPermissionLevel || hasAllowedPositions);

    }

    /**
     * @param {Guild} guild
     * @param {string} permissionLevel
     * @param {string[]} allowedPositions Positions that alone will give permission (or)
     * @param {string[]} requiredPositions Positions that are all required for permission (and)
     * @returns {boolean} If the permissible has the permissionlevel **OR** higher **OR** the allowedPositions **AND** all the requiredPositions
     */
    hasGuildPermission(guild, permissionLevel, allowedPositions, requiredPositions) {

        if (!this.user.discord_id) return false;

        const member = guild.members.cache.get(this.user.discord_id)
        if (!member) return false;

        return this.bot.permissions.hasPermission(this, member, permissionLevel, allowedPositions, requiredPositions);

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

        await this.fetchPositions()
        return this.bot.permissions.hasPermission(this, member, permissionLevel, allowedPositions, requiredPositions);

    }

    /**
     * @param {import('../types').PositionResolvable} permissionLevel
     */
    hasPermissionLevel(permissionLevel) {

        const position = this.resolvePosition(permissionLevel)
        if (!position) return false;

        return this.hasSomePositions(position.getPermissionLevelPositions())

    }

    async fetchPositions(show_expired=false) {

        const userPositions = await this.client.userPositions.fetch({ id_user: this.user.id_user, show_expired }, false)
        return this.setPositions(userPositions);

    }

}

module.exports = ScrimsUserPositionsCollection;