const DBTable = require("../postgresql/table");
const ScrimsPosition = require("./position");
const ScrimsUser = require("./user");

class ScrimsUserPosition extends DBTable.Row {

    constructor(client, userData) {

        super(client, {})

        /**
         * @type Integer
         */
        this.id_user = userData.id_user;
        
        /**
         * @type ScrimsUser
         */
        this.user = this.getUser(userData.user);


        /**
         * @type Integer
         */
        this.id_position = userData.id_position;

         /**
         * @type ScrimsUser
         */
        this.position = this.getPosition(userData.position);


        /**
         * @type Integer
         */
        this.id_executor = userData.id_executor;

        /**
         * @type Integer
         */
        this.given_at = userData.given_at;

        /**
         * @type Integer
         */
        this.expires_at = userData.expires_at;

    }

    /**
     * @override 
     */
    updateWith(data) {

        if (data.user && (data.id_user != this.id_user)) {

            this.removeUserHandle()

            this.id_user = data.user.id_user
            this.user = this.getUser(data.user)

        }

        if (data.position && (data.id_position != this.id_position)) {

            this.removePositionHandle()

            this.id_position = data.position.id_position
            this.position = this.getPosition(data.position)

        }

        if (data.id_executor) this.id_executor = data.id_executor;
        
        if (data.given_at) this.given_at = data.given_at;

        if (data.expires_at) this.expires_at = data.expires_at;

        return this;
        
    }

    /**
     * @override 
     */
    close() {
        
        this.removeUserHandle()
        this.removePositionHandle()
        
    }

    removeUserHandle() {

        if (this.user && this.__userHandleId) 
            this.client.users.cache.removeHandle({ id_user: this.user.id_user }, this.__userHandleId)
            
    }

    removePositionHandle() {
  
        if (this.position && this.__positionHandleId) 
            this.client.positions.cache.removeHandle({ id_position: this.position.id_position }, this.__positionHandleId)

    }

    getUser(userData) {

        if (!userData) return null;

        const cachedUser = this.client.users.cache.get({ id_user: userData.id_user })[0]
        if (cachedUser) {

            this.__userHandleId = this.client.users.cache.addHandle({ id_user: userData.id_user })
            if (!this.__userHandleId) return null;

            return cachedUser;

        }

        const newUser = new ScrimsUser(this.client, userData)
        
        this.__userHandleId = 1
        this.client.users.cache.push(newUser, 0, [this.__userHandleId])    
        
        return newUser;

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

module.exports = ScrimsUserPosition;