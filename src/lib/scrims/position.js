const DBTable = require("../postgresql/table");

class ScrimsPosition extends DBTable.Row {

    constructor(client, positionData) {

        super(client, {});

        /**
         * @type { Integer }
         */
        this.id_position = positionData.id_position

        /**
         * @type { String }
         */
        this.name = positionData.name

         /**
         * @type { Boolean }
         */
        this.sticky = positionData.sticky

        /**
         * @type { Integer }
         */
        this.level = positionData.level

    }

}

module.exports = ScrimsPosition;