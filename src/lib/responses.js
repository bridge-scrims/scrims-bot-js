const { MessageEmbed, MessageActionRow, MessageButton, MessageSelectMenu, MessageAttachment, BaseMessageComponent } = require("discord.js");

class ScrimsMessageBuilder {

    static warningYellow = "#EBB611"
    static errorRed = "#DC0023"

    static errorMessage(title, description) {
        return {
            ephemeral: true,
            embeds: [
                new MessageEmbed()
                    .setColor(this.errorRed)
                    .setTitle(title)
                    .setDescription(description)
            ]
        }
    }

    static warningMessage(title, description) {
        return {
            ephemeral: true,
            embeds: [
                new MessageEmbed()
                    .setColor(this.warningYellow)
                    .setTitle(title)
                    .setDescription(description)
            ]
        }
    }

    static guildOnlyMessage() {

        return this.errorMessage(
            "Guild Only", "This command can only be used in discord servers!"
        );
    
    }

    static scrimsUserNeededMessage() {

        return this.errorMessage(
            "Unkown Scrims User", `You have not yet been properly identified by the bridge scrims server. Please try again in a moment.`
        );
    
    }
    
}

module.exports = ScrimsMessageBuilder;