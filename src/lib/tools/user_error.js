const { MessageEmbed } = require("discord.js");

class UserError extends Error {

    constructor(...args) {

        super();
        this.payload = (args.length === 1) ? args[0] : this.buildPayload(...args);
        
    }

    buildPayload(title, description) {

        const embed = new MessageEmbed()
            .setColor("#DC0023").setTitle(title).setDescription(description)

        return { ephemeral: true, components: [], content: null, embeds: [embed] };

    }

    toMessage() {

        return this.payload;

    }

}

module.exports = UserError;