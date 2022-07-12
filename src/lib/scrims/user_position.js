const TableRow = require("../postgresql/row");
const ScrimsPosition = require("./position");

class ScrimsUserPosition extends TableRow {

    static uniqueKeys = ['id_user', 'id_position']
    static columns = ['id_user', 'id_position', 'id_executor', 'given_at', 'expires_at']

    static sortByLevel(a, b) {
        const getPosition = (e) => (e.position ?? { id_position: e.id_position });
        return ScrimsPosition.sortByLevel(getPosition(a), getPosition(b));
    }

    static removeExpired(v) {
        return !(v.isExpired());
    }

    constructor(client, userPositionData) {

        super(client, userPositionData)

        /** @type {string} */
        this.id_user
        
        /** @type {import('./user')} */
        this.user

        /** @type {number} */
        this.id_position

        /** @type {ScrimsPosition} */
        this.position
        
        /** @type {string} */
        this.id_executor

        /** @type {import('./user')} */
        this.executor

        /** @type {number} */
        this.given_at
        if (!this.given_at) this.setGivenPoint()

        /** @type {number} */
        this.expires_at

    }

    /**
     * @param {string|Object.<string, any>|import('./user')} userResolvable 
     */
    setUser(userResolvable) {

        this._setForeignObjectReference(this.client.users, 'user', ['id_user'], ['id_user'], userResolvable)
        return this;

    }

    getUserMention(effect, ...args) {

        if (!this.user) return `${effect}unknown-user${effect}`;
        return this.user.getMention(effect, ...args);

    }

    /**
     * @param {string|number|Object.<string, any>|ScrimsPosition} positionResolvable 
     */
    setPosition(positionResolvable) {

        if (typeof positionResolvable === "string") positionResolvable = { name: positionResolvable }

        this._setForeignObjectReference(this.client.positions, 'position', ['id_position'], ['id_position'], positionResolvable)
        return this;

    }

    /**
     * @param {string|Object.<string, any>|import('./user')} userResolvable 
     */
    setExecutor(userResolvable) {

        this._setForeignObjectReference(this.client.users, 'executor', ['id_executor'], ['id_user'], userResolvable)
        return this;

    }

    getExecutorMention(effect, ...args) {

        if (!this.executor) return `${effect}unknown-user${effect}`;
        return this.executor.getMention(effect, ...args);

    }

    /**
     * @param {number} [given_at] if falsley will use current time 
     */
    setGivenPoint(given_at) {

        this.given_at = given_at ?? Math.floor(Date.now()/1000)
        return this;

    }

    /**
     * @param {number} [expires_at] if falsley will use null (no expiration)
     */
    setExpirationPoint(expires_at=null) {

        this.expires_at = expires_at
        return this;

    }

    /** 
     * @override
     * @param {Object.<string, any>} userPositionData 
     */
    update(userPositionData) {
        
        super.update(userPositionData);

        this.setUser(userPositionData.user)
        this.setPosition(userPositionData.position)
        this.setExecutor(userPositionData.executor)

        return this;

    }

    isCacheExpired(now) {

        return this.isExpired() || super.isCacheExpired(now);
        
    }

    isExpired() {

        return (this.expires_at !== null && this.expires_at <= (Date.now()/1000));

    }

    getDuration() {

        return (this.expires_at === null) ? `\`permanently\`` 
            : ((!this.expires_at) ? '`for an unknown time period`' : `until <t:${this.expires_at}:F>`);

    }

    getExpirationDetail() {

        return (this.expires_at === null) ? `[permanent]` 
            : ((!this.expires_at) ? '[unknown-duration]' : `[expires <t:${this.expires_at}:R>]`);

    }

    toString(guild_id) {

        const connectivity = ((guild_id && this.position && this.position.getConnectedRoles(guild_id).length > 0) ? (" **⇨** " + this.position.getConnectedRoles(guild_id).join(" ")) : "")
        const expiration = (this.expires_at ? ` (expires <t:${this.expires_at}:R>)` : "")
        return `**${this.position?.name}** (${this.id_position})${connectivity}${expiration}`;

    }

}

module.exports = ScrimsUserPosition;