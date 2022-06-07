const ScrimsSyncHostFeature = require("./sync-host/feature");
const SuggestionFeature = require("./suggestions/feature");
const PositionsFeature = require("./positions/feature");
const LoggingFeature = require("./logging/feature");
const SupportFeature = require("./support/feature");
const ScrimsBot = require("./lib/bot");

class ScrimsJSBot extends ScrimsBot {

    constructor(config) {

        const intents = [ "GUILD_MEMBERS", "GUILDS", "GUILD_MESSAGE_REACTIONS", "GUILD_MESSAGES", "GUILD_VOICE_STATES", "GUILD_PRESENCES" ]
        const partials = [ 'GUILD_MEMBER', 'USER', 'MESSAGE', 'CHANNEL', 'REACTION' ]
        const presence = { activities: [{ name: 'affordable hosting', type: 'WATCHING' }] }

        super(intents, partials, presence, config);

        this.support = new SupportFeature(this, config)
        this.positions = new PositionsFeature(this, config)
        this.suggestions = new SuggestionFeature(this, config)
        this.syncHost = new ScrimsSyncHostFeature(this, config)

        this.logging = new LoggingFeature(this, config)

    }
    
}

module.exports = ScrimsJSBot;
