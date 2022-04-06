const { MessageEmbed, MessageActionRow, MessageButton, MessageSelectMenu, MessageAttachment, BaseMessageComponent } = require("discord.js");

class ScrimsMessageBuilder {

    static warningYellow = "#EBB611"
    static successGreen = "#00DB0E"
    static errorRed = "#DC0023"

    static errorMessage(title, description) {

        return {
            ephemeral: true,
            components: [],
            content: null,
            embeds: [
                new MessageEmbed()
                    .setColor(this.errorRed)
                    .setTitle(title)
                    .setDescription(description)
            ]
        };

    }

    static warningMessage(title, description) {

        return {
            ephemeral: true,
            components: [],
            content: null,
            embeds: [
                new MessageEmbed()
                    .setColor(this.warningYellow)
                    .setTitle(title)
                    .setDescription(description)
            ]
        };

    }

    static button(label, style, customId) {

        return new MessageButton()
            .setLabel(label)
            .setStyle(style)
            .setCustomId(customId);

    }

    static cancelButton() {

        return this.button("Cancel", 2, `CANCEL`);

    }

    /**
     * Creates a `Command Failed` message payload.
     * 
     * @param {string} action (Unable to **action** at the moment) 
     */
    static failedMessage(action) {

        return this.errorMessage(`Command Failed`, `Unable to ${action} at the moment. Please try again later.`);

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

    static missingPermissionsMessage(message) {

        return this.errorMessage("Insufficient Permissions", message);
    
    }

    static createMultipleEmbeds(items, getEmbed) {
        
        const max = 25
        
        const containers = Array.from(Array(Math.ceil(items.length / max)).keys())
        const containerSize = Math.floor(items.length / containers.length)
        const overflow = items.length % containerSize

        const embedData = containers.map((_, i) => items.slice(i*containerSize, containerSize))

        const lastIdx = embedData.length-1
        if (overflow > 0) embedData[lastIdx] = embedData[lastIdx].concat(items.slice(-overflow))

        return embedData.map((items, idx, containers) => getEmbed(items, idx, containers))

    }
    
}

module.exports = ScrimsMessageBuilder;