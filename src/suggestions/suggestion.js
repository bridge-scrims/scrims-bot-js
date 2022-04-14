const DBTable = require("../lib/postgresql/table");
const ScrimsUser = require("../lib/scrims/user");

class ScrimsSuggestion extends DBTable.Row {

    constructor(client, suggestionData) {

        super(client, {})

        /**
         * @type { Integer } 
         */
        this.id_suggestion = suggestionData.id_suggestion;
        
        /**
         * @type { Integer }
         */
        this.id_guild = suggestionData.id_guild;

        /**
         * @type { ScrimsGuild }
         */
        this.scrimsGuild
        this.setScrimsGuild(suggestionData.guild)
        this.client.guilds.cache.on("push", guild => (guild.id_guild == this.id_guild) ? this.setScrimsGuild(guild) : null)

        /**
         * @type { String } 
         */
        this.channel_id = suggestionData.channel_id;

        /**
         * @type { String } 
         */
        this.message_id = suggestionData.message_id;

        /**
         * @type { String } 
         */
        this.suggestion = suggestionData.suggestion;

        /**
         * @type { Integer } 
         */
        this.created_at = suggestionData.created_at;

        /**
         * @type { Integer } 
         */
        this.id_creator = suggestionData.id_creator;

        /**
         * @type { ScrimsUser }
         */
        this.creator
        this.setCreator(suggestionData.creator)
        this.client.users.cache.on("push", user => (user.id_creator == this.id_creator) ? this.setCreator(user) : null)

        /**
         * @type { Integer } 
         */
        this.epic = suggestionData.epic;

    }

    get guild() {

        if (!this.scrimsGuild) return null;
        return this.scrimsGuild.guild;

    }

    setScrimsGuild(obj) {

        this.scrimsGuild = this.createHandle("guild", this.client.guilds, { id_guild: this.id_guild }, obj);

    }

    setCreator(obj) {

        this.creator = this.createHandle("creator", this.client.users, { id_user: this.id_creator }, obj);

    }

    /**
     * @override 
     */
    updateWith(data) {

        if (data.id_creator && (data.id_creator != this.id_creator)) {

            this.id_creator = data.id_creator
            this.setCreator(data.creator)

        }

        if (data.id_guild && (data.id_guild != this.id_guild)) {

            this.id_guild = data.id_guild
            this.setScrimsGuild(data.guild)

        }

        if (data.channel_id) this.channel_id = data.channel_id;
        
        if (data.message_id) this.message_id = data.message_id;

        if (data.suggestion) this.suggestion = data.suggestion;

        if (data.created_at) this.created_at = data.created_at;

        if (data.epic) this.epic = data.epic;
        
        return this;
        
    }

    /**
     * @override 
     */
    close() {
        
        this.removeHandle("guild", this.client.guilds, { id_guild: this.id_guild })
        this.removeHandle("creator", this.client.users, { id_user: this.id_creator })

    }

}

module.exports = ScrimsSuggestion;