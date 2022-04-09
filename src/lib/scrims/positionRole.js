const DBTable = require("../postgresql/table");
const ScrimsPosition = require("./position");

class ScrimsPositionRole extends DBTable.Row {

    constructor(client, positionRoleData) {

        super(client, {})

        /**
         * @type Integer
         */
        this.id_position = positionRoleData.id_position;

         /**
         * @type ScrimsUser
         */
        this.position = this.getPosition(positionRoleData.position);


        /**
         * @type String
         */
        this.role_id = positionRoleData.role_id;

        /**
         * @type String
         */
        this.guild_id = positionRoleData.guild_id;

    }

    close() {

        if (this.position && this.__positionHandleId) 
            this.client.positions.cache.removeHandle({ id_position: this.position.id_position }, this.__positionHandleId)

    }

    getPosition(positionData) {

        if (!positionData) return null;

        const cachedPosition = this.client.positions.cache.get({ id_position: positionData.id_position })[0]
        if (cachedPosition) {

            this.__positionHandleId = this.client.positions.cache.addHandle({ id_position: positionData.id_position })
            if (!this.__positionHandleId) return null;

            return cachedPosition;

        }

        const newPosition = new ScrimsPosition(this.client, positionData)
        
        this.__positionHandleId = 1
        this.client.positions.cache.push(newPosition, 0, [this.__positionHandleId])    
        
        return newPosition;

    }

}

module.exports = ScrimsPositionRole;