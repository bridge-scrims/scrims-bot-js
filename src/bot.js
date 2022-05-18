const ScrimsSyncHostFeature = require("./sync-host/feature");
const SuggestionFeature = require("./suggestions/feature");
const PositionsFeature = require("./positions/feature");
const DBClient = require("./lib/postgresql/database");
const LoggingFeature = require("./logging/feature");
const SupportFeature = require("./support/feature");
const ScrimsBot = require("./lib/bot");

/**
 * @typedef { DBClient & SuggestionFeature.tables } ScrimsJSBotDBClient
 */

class ScrimsJSBot extends ScrimsBot {

    constructor(config) {

        const intents = [ "GUILD_MEMBERS", "GUILDS", "GUILD_MESSAGE_REACTIONS", "GUILD_MESSAGES", "GUILD_VOICE_STATES" ]
        const partials = [ 'GUILD_MEMBER', 'USER', 'MESSAGE', 'CHANNEL', 'REACTION' ]

        super(intents, partials, config);

        /**
         * @type { ScrimsJSBotDBClient }
         */
        this.database

        this.support = new SupportFeature(this, config)
        this.positions = new PositionsFeature(this, config)
        this.suggestions = new SuggestionFeature(this, config)
        this.syncHost = new ScrimsSyncHostFeature(this, config)

        this.logging = new LoggingFeature(this, config)

        this.on('ready', () => this.user.setPresence({ activities: [{ type: 'LISTENING', name: 'the cat in the hat' }] }))

    }
    
}

module.exports = ScrimsJSBot;
