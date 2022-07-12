const I18n = require("../tools/internationalization");
const TableRow = require("../postgresql/row");
const ScrimsPosition = require("./position");
const { Role } = require("discord.js");
const ScrimsUser = require("./user");

class ScrimsVouch extends TableRow {

    static uniqueKeys = ['id_vouch']
    static columns = ['id_vouch', 'id_user', 'id_position', 'id_executor', 'given_at', 'worth', 'comment']

    static nonExpired(v) {
        return !v.isExpired();
    }

    constructor(table, vouchData) {

        super(table, vouchData)

        /** @type {string} */
        this.id_vouch
        if (!this.id_vouch) this.setId()
        
        /** @type {string} */
        this.id_user

        /** @type {ScrimsUser} */
        this.user

        /** @type {number} */
        this.id_position

        /** @type {ScrimsPosition} */
        this.position

        /** @type {string|null} */
        this.id_executor

        /** @type {ScrimsUser|null} */
        this.executor

        /** @type {number} */
        this.given_at

        /** @type {number} */
        this.worth

        /** @type {string|null} */
        this.comment

    }

    isPositive() {

        return (this.worth > 0);

    }

    isExpired() {

        if (this.worth < 0) return (Date.now()/1000) >= this.given_at+(60*60*24*7*2);
        return (Date.now()/1000) >= this.given_at+(60*60*24*30.41*2);

    }

    /**
     * @param {string} [id_vouch] if falsley will use a random uuid
     */
    setId(id_vouch) {

        this.id_vouch = id_vouch ?? this.client.generateUUID()
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
    setGivenAt(given_at) {

        this.given_at = given_at ?? Math.floor(Date.now()/1000)
        return this;

    }

    /** @param {number} worth */
    setWorth(worth) {

        this.worth = worth
        return this;

    }

    /** @param {string|null} comment */
    setComment(comment) {

        this.comment = comment
        return this;

    }

    /** 
     * @override
     * @param {Object.<string, any>} vouchData 
     */
    update(vouchData) {
        
        super.update(vouchData);

        this.setUser(vouchData.user)
        this.setPosition(vouchData.position)
        this.setExecutor(vouchData.executor)

        return this;

    }

    isCacheExpired(now) {

        return this.isExpired() || super.isCacheExpired(now);
        
    }

    /**
     * @param {I18n} i18n
     * @param {Role} primeCouncilRole 
     * @returns {import("discord.js").EmbedFieldData}
     */
    toEmbedField(i18n, primeCouncilRole=null) {
        
        const comment = `${this.comment ? ` ${i18n.get('vouch_comment', this.comment)}` : ''}.`
        const time = `<t:${this.given_at}:D>` 

        if (this.id_executor) {

            const name = ((this.worth < 0) ? `⛔ ${i18n.get('zero_vouch')} | ${time}` : `✅ ${i18n.get('vouch')} | ${time}`)
            const value = i18n.get('vouch_description', (this.executor ? this.executor.getMention('**') : i18n.get('from_unknown_user')), comment)
            return { name, value };

        }
        
        const name = (this.worth < 0) ? `❌ ${i18n.get('vouch_decision_denied')} | ${time}` : `☑️ ${i18n.get('vouch_decision_accepted')} | ${time}`
        const value = i18n.get('vouch_decision_description', (primeCouncilRole ? `${primeCouncilRole}` : `council`), comment)
        
        return { name, value };

    }

}

module.exports = ScrimsVouch;