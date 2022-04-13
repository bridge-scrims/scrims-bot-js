const DBTable = require("../lib/postgresql/table");
const ScrimsUser = require("../lib/scrims/user");

class ScrimsSuggestion extends DBTable.Row {

    constructor(client, suggestionData) {

        super(client, {})

        /**
         * @type Integer
         */
        this.id_suggestion = suggestionData.id_suggestion;
        
        /**
         * @type String
         */
        this.channel_id = suggestionData.channel_id;

        /**
         * @type String
         */
        this.message_id = suggestionData.message_id;

         /**
         * @type String
         */
        this.suggestion = suggestionData.suggestion;

        /**
         * @type Integer
         */
        this.created_at = suggestionData.created_at;

        /**
         * @type Integer
         */
        this.id_creator = suggestionData.id_creator;

        /**
         * @type { ScrimsUser }
         */
        this.creator = this.getUser(suggestionData.creator)

        /**
         * @type Integer
         */
        this.epic = suggestionData.epic;

    }

    /**
     * @override 
     */
    updateWith(data) {

        if (data.creator && (data.id_creator != this.id_creator)) {

            this.removeUserHandle()

            this.id_creator = data.creator.id_creator
            this.creator = this.getUser(data.creator)

        }

        if (data.channel_id) this.channel_id = data.channel_id;
        
        if (data.message_id) this.message_id = data.message_id;

        if (data.suggestion) this.suggestion = data.suggestion;

        if (data.created_at) this.created_at = data.created_at;

        if (data.id_creator) this.id_creator = data.id_creator;

        if (data.epic) this.epic = data.epic;
        
        return this;
        
    }

    /**
     * @override 
     */
    close() {
        
        this.removeUserHandle()
        
    }

    removeUserHandle() {

        if (this.user && this.__userHandleId) 
            this.client.users.cache.removeHandle({ id_user: this.user.id_user }, this.__userHandleId)
            
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

}

module.exports = ScrimsSuggestion;