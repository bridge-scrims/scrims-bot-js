const DBTable = require("../postgresql/table");
const ScrimsPosition = require("./position");
const ScrimsUser = require("./user");

class ScrimsUserPosition extends DBTable.Row {

    constructor(client, userPositionData) {

        super(client, {})

        /**
         * @type { Integer }
         */
        this.id_user = userPositionData.id_user;
        
        /**
         * @type { ScrimsUser }
         */
        this.user
        this.setScrimsUser(userPositionData.user)
        this.client.users.cache.on("push", user => (user.id_user == this.id_user) ? this.setScrimsUser(user) : null)


        /**
         * @type { Integer }
         */
        this.id_position = userPositionData.id_position;

        /**
         * @type { ScrimsPosition }
         */
        this.position
        this.setPosition(userPositionData.position)
        this.client.positions.cache.on("push", position => (position.id_position == this.id_position) ? this.setPosition(position) : null)


        /**
         * @type { Integer }
         */
        this.id_executor = userPositionData.id_executor;

        /**
         * @type { ScrimsUser }
         */
        this.executor
        this.setExecutorUser(userPositionData.executor)
        this.client.users.cache.on("push", user => (user.id_user == this.id_executor) ? this.setExecutorUser(user) : null)


        /**
         * @type { Integer }
         */
        this.given_at = userPositionData.given_at;


        /**
         * @type { Integer }
         */
        this.expires_at = userPositionData.expires_at;

    }

    setScrimsUser(obj) {

        this.user = this.createHandle("user", this.client.users, { id_user: this.id_user }, obj);

    }

    setPosition(obj) {

        this.position = this.createHandle("position", this.client.positions, { id_position: this.id_position }, obj);

    }

    setExecutorUser(obj) {

        this.executor = this.createHandle("executor", this.client.users, { id_user: this.id_executor }, obj);

    }

    /**
     * @override 
     */
    updateWith(data) {

        if (data.id_user && (data.id_user != this.id_user)) {

            this.id_user = data.id_user
            this.setScrimsUser(data.user)

        }

        if (data.id_position && (data.id_position != this.id_position)) {

            this.id_position = data.id_position
            this.setPosition(data.position)

        }

        if (data.id_executor && ( data.id_executor != this.id_executor)) {

            this.id_executor = data.id_executor
            this.setExecutorUser(data.executor)

        }

        if (data.given_at) this.given_at = data.given_at;

        if (data.expires_at) this.expires_at = data.expires_at;

        return this;
        
    }

    getDuration() {

        return (this.expires_at === null) ? `\`permanently\`` 
            : ((!this.expires_at) ? '\`for an unknown time period\`' : `until <t:${this.expires_at}:F>`);

    }

    /**
     * @override 
     */
    close() {
        
        this.removeHandle("user", this.client.users, { id_user: this.id_user })
        this.removeHandle("position", this.client.positions, { id_position: this.id_position })
        this.removeHandle("executor", this.client.users, { id_user: this.id_executor })
        
    }

}

module.exports = ScrimsUserPosition;