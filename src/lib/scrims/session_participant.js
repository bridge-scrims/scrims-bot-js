const TableRow = require("../postgresql/row");

const ScrimsSession = require("./session");
const ScrimsUser = require("./user");

class ScrimsSessionParticipant extends TableRow {

    static uniqueKeys = ['id_session', "id_user"]
    static columns = ['id_session', 'id_user', "joined_at", "participation_time"]

    constructor(client, participantData) {

        super(client, participantData)

        /** @type {string} */
        this.id_session

        /** @type {ScrimsSession} */
        this.session

        /** @type {string} */
        this.id_user

        /** @type {ScrimsUser} */
        this.user

        /** @type {number} */
        this.joined_at

        /** @type {number} */
        this.participation_time

    }

    /**
     * @param {string|Object.<string, any>|ScrimsSession} sessionResolvable 
     */
    setSession(sessionResolvable) {

        this._setForeignObjectReference(this.client.sessions, 'session', ['id_session'], ['id_session'], sessionResolvable)
        return this;

    }

    /**
     * @param {string|Object.<string, any>|ScrimsUser} userResolvable 
     */
    setUser(userResolvable) {

        this._setForeignObjectReference(this.client.users, 'user', ['id_user'], ['id_user'], userResolvable)
        return this;

    }

    /**
     * @param {number} [joined_at] If undefined will use current timestamp 
     */
    setJoinPoint(joined_at) {

        this.joined_at = (joined_at === undefined) ? Math.floor(Date.now()/1000) : joined_at
        return this;

    }

    /**
     * @param {number} participation_time
     */
    setParticipationTime(participation_time) {

        this.participation_time = participation_time
        return this;

    }

    /** 
     * @override
     * @param {Object.<string, any>} participantData 
     */
    update(participantData) {
        
        super.update(participantData);

        this.setSession(participantData.session)
        this.setUser(participantData.user)

        return this;

    }

}

module.exports = ScrimsSessionParticipant;