const TableRow = require("../postgresql/row");

const ScrimsSessionType = require("./session_type");
const ScrimsUser = require("./user");

class ScrimsSession extends TableRow {

    static uniqueKeys = ['id_session']
    static columns = ['id_session', 'id_type', "id_creator", "started_at", "ended_at"]

    constructor(client, sessionData) {

        super(client, sessionData)

        /** @type {string} */
        this.id_session

        /** @type {number} */
        this.id_type

        /** @type {ScrimsSessionType} */
        this.type

        /** @type {string} */
        this.id_creator

        /** @type {ScrimsUser} */
        this.creator

        /** @type {number} */
        this.started_at

        /** @type {number} */
        this.ended_at
        
    }

    /**
     * @param {string} [id_session] if falsley will use a random uuid
     */
    setId(id_session) {

        this.id_session = id_session ?? this.client.generateUUID()
        return this;

    }

    /**
     * @param {number|string|Object.<string, any>|ScrimsSessionType} typeResolvable 
     */
    setType(typeResolvable) {

        if (typeof typeResolvable === "string") typeResolvable = { name: typeResolvable }

        this._setForeignObjectReference(this.client.sessionTypes, 'type', ['id_type'], ['id_type'], typeResolvable)
        return this;

    }

    /**
     * @param {string|Object.<string, any>|ScrimsUser} userResolvable 
     */
    setCreator(userResolvable) {

        this._setForeignObjectReference(this.client.users, 'creator', ['id_creator'], ['id_user'], userResolvable)
        return this;

    }

    /**
     * @param {number} [started_at] If undefined will use current timestamp 
     */
    setStartPoint(started_at) {

        this.started_at = (started_at === undefined) ? Math.floor(Date.now()/1000) : started_at
        return this;
        
    }

    /**
     * @param {number} [ended_at] If undefined will use current timestamp 
     */
    setEndPoint(ended_at) {

        this.ended_at = (ended_at === undefined) ? Math.floor(Date.now()/1000) : ended_at
        return this;

    }

    /** 
     * @override
     * @param {Object.<string, any>} sessionData 
     */
    update(sessionData) {
        
        super.update(sessionData);

        this.setType(sessionData.type)
        this.setCreator(sessionData.creator)

        return this;

    }

}

module.exports = ScrimsSession;