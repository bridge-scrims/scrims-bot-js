const ScrimsMessageBuilder = require("../responses")

class UserError extends Error {

    constructor(...args) {

        super();
        this.payload = (args.length === 1) ? args[0] : ScrimsMessageBuilder.errorMessage(args[0], args[1]);
        
    }

    toMessage() {

        return this.payload;

    }

}

module.exports = UserError;