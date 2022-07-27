const TableRow = require("../postgresql/row")
const ScrimsGameType = require("./game_type")

class ScrimsGame extends TableRow {

    static uniqueKeys = ['id_game']
    static columns = ['id_game', 'id_type']

    constructor(client, gameData) {

        super(client, gameData)

        /** @type {number} */
        this.id_game

        /** @type {number} */
        this.id_type

        /** @type {ScrimsGameType} */
        this.type

    }

    /** @override */
    isCacheExpired(now) {
        return ((this.id_game + 30*24*60*60*1000) < now) && (!now || super.isCacheExpired(now));
    }

    /**
     * @param {number} [id] If falsley will use the current timestamp.
     */
    setId(id) {

        this.id_game = id ?? Date.now()
        return this

    }

    /**
     * @param {string|ScrimsGameType} typeResolvable 
     */
    setType(typeResolvable) {

        if (typeof typeResolvable === "string") typeResolvable = { name: typeResolvable }
        this._setForeignObjectReference(this.client.gameTypes, 'type', ['id_type'], ['id_type'], typeResolvable)
        return this

    }   

    /** 
     * @override
     * @param {Object.<string, any>} gameData 
     */
    update(gameData) {
            
        super.update(gameData)
        this.setType(gameData.type)
        return this

    }

}

module.exports = ScrimsGame