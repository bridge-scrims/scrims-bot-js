const TableRow = require("../postgresql/row");
const ScrimsPosition = require("./position");

class ScrimsUserPosition extends TableRow {

    static uniqueKeys = ['id_user', 'id_position']
    static columns = ['id_user', 'id_position', 'id_executor', 'given_at', 'expires_at']

    static sortByLevel(a, b) {

        return ((a?.positions?.level ?? 100) - (b?.position?.level ?? 100));
        
    }

    constructor(client, userPositionData) {

        super(client, userPositionData)

        /** @type {string} */
        this.id_user
        
        /** @type {ScrimsUser} */
        this.user

        /** @type {number} */
        this.id_position

        /** @type {ScrimsPosition} */
        this.position
        
        /** @type {string} */
        this.id_executor

        /** @type {ScrimsUser} */
        this.executor

        /** @type {number} */
        this.given_at
        if (!this.given_at) this.setGivenPoint()

        /** @type {number} */
        this.expires_at

    }

    /**
     * @param {string|Object.<string, any>|ScrimsUser} userResolvable 
     */
    setUser(userResolvable) {

        this._setForeignObjectReference(this.client.users, 'user', ['id_user'], ['id_user'], userResolvable)
        return this;

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
     * @param {string|Object.<string, any>|ScrimsUser} userResolvable 
     */
    setExecutor(userResolvable) {

        this._setForeignObjectReference(this.client.users, 'executor', ['id_executor'], ['id_user'], userResolvable)
        return this;

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
            : ((!this.expires_at) ? '\`for an unknown time period\`' : `until <t:${this.expires_at}:F>`);

    }

}

module.exports = ScrimsUserPosition;