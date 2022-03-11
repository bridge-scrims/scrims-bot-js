const { MessageEmbed, MessageActionRow, MessageButton, MessageSelectMenu, MessageAttachment, BaseMessageComponent } = require("discord.js");

function hsv2rgb(h, s, v) {                              
    const f = (n,k=(n+h/60)%6) => v - v*s*Math.max(Math.min(k,4-k,1), 0);     
    return [f(5),f(3),f(1)];
} 

class ResponseTemplates {

    static suggestionBlue = "#198DD5"
    static successGreen = "#0BE468"
    static errorRed = "#DC0023"

    static suggestionsInfoActions() {
        return new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setLabel('Make a Suggestion')
                    .setCustomId(`suggestion/create`)
                    .setStyle('PRIMARY')
                    .setEmoji('📢')
            )
    }

    static suggestionsInfoEmbed(guildname) {
        return new MessageEmbed()
            .setTitle("Share Your Ideas")
            .setColor(this.suggestionBlue)
            .setDescription(`This is the place where you can submit your great ideas for ${guildname}. Just press the button below to get started!`)
    }

    static suggestionsInfoMessage(guildname) {
        return {
            content: null,
            components: [ this.suggestionsInfoActions() ],
            embeds: [ this.suggestionsInfoEmbed(guildname) ]
        }
    }

    static suggestionSentMessage() {
        const deleteInstructions = "by right-clicking on your suggestion's message and clicking on **Apps** -> **Remove Suggestion**."
        return {
            embeds: [
                new MessageEmbed()
                    .setColor(this.successGreen)
                    .setTitle("Suggestion Sent")
                    .setDescription(
                        "Your suggestion was successfully created! "
                        + `If you are unhappy with your suggestion you can delete it any time ${deleteInstructions}`
                    )
            ],
            ephemeral: true
        }
    }


    static suggestionEmbed(hue, suggestion) {
        return new MessageEmbed()
            .setAuthor({ name: suggestion.creator, iconURL: suggestion.creatorAvatar })
            .setColor(hsv2rgb(hue, 1, 1))
            .setDescription(suggestion.suggestion)
    }

    static errorMessage(title, description) {
        return {
            ephemeral: true,
            embeds: [
                new MessageEmbed()
                    .setColor(this.errorRed)
                    .setTitle(title)
                    .setDescription(description)
                    .setTimestamp()
            ]
        }
    }
    
}

module.exports = ResponseTemplates;