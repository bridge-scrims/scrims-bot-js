const ScrimsMessageBuilder = require("../responses")

class UserError extends Error {

    constructor(title, message) {

        super(message)
        this.title = title
        this.message = message
        
    }

    toMessage() {

        return ScrimsMessageBuilder.errorMessage(this.title, this.message);

    }

}

module.exports = UserError;