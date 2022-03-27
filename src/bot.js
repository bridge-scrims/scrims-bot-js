
const SuggestionFeature = require("./suggestions/feature");
const SupportFeature = require("./support/feature");
const ScrimsBot = require("./lib/bot");

class ScrimsJSBot extends ScrimsBot {

    constructor(config) {

        const intents = [ "GUILD_MEMBERS", "GUILDS", "GUILD_MESSAGE_REACTIONS", "GUILD_MESSAGES" ]
        const partials = [ 'GUILD_MEMBER', 'USER', 'MESSAGE', 'CHANNEL', 'REACTION' ]

        super(intents, partials, config);

        this.support = new SupportFeature(this, this.support)
        this.suggestions = new SuggestionFeature(this, this.suggestions)

    }

}


module.exports = ScrimsJSBot;
