const TableRow = require("../postgresql/row")
const ScrimsGameType = require("./game_type")
const ScrimsGame = require("./game")
const ScrimsUser = require("./user")

class ScrimsGameParticipant extends TableRow {

    static uniqueKeys = ['id_game', 'id_user', 'id_team']
    static columns = ['id_game', 'id_user', 'id_team']

    constructor(client, participantData) {

        super(client, participantData)

        /** @type {number} */
        this.id_game

        /** @type {ScrimsGame} */
        this.game

        /** @type {string} */
        this.id_user

        /** @type {ScrimsUser} */
        this.user

        /** @type {number} */
        this.id_team

    }

    /** @override */
    isCacheExpired(now) {
        return (!this.game || !this.user) && (!now || super.isCacheExpired(now));
    }

    /**
     * @param {number|Object.<string, any>|ScrimsGame} gameResolvable
     */
    setGame(gameResolvable) {

        this._setForeignObjectReference(this.client.games, 'game', ['id_game'], ['id_game'], gameResolvable)
        return this

    }

    /**
     * @param {string|Object.<string, any>|ScrimsUser} userResolvable
     */
    setUser(userResolvable) {

        this._setForeignObjectReference(this.client.users, 'user', ['id_user'], ['id_user'], userResolvable)
        return this

    } 

    /** 
     * @override
     * @param {Object.<string, any>} gameData 
     */
    update(gameData) {
            
        super.update(gameData)
        this.setUser(gameData.user)
        this.setGame(gameData.game)
        return this

    }

}

module.exports = ScrimsGameParticipant