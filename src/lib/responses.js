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
    
}

module.exports = ScrimsMessageBuilder;