const { MessageEmbed, MessageActionRow, MessageButton, MessageSelectMenu, MessageAttachment, BaseMessageComponent } = require("discord.js");
const ScrimsMessageBuilder = require("../lib/responses");

function hsv2rgb(h, s, v) {                              
    
    const i = Math.floor( (h/360)*6 )            
    const a = v * ( 1 - s )
    const b = v * ( 1 - s * ( (h/360)*6 - i ) )
    const c = v * ( 1 - s * ( 1 - ( (h/360)*6 - i ) ) )
 
    const values = (() => {
        if ( i === 0 ) return [ v, c, a ];
        if ( i === 1 ) return [ b, v, a ];
        if ( i === 2 ) return [ a, v, c ]; 
        if ( i === 3 ) return [ a, b, v ];
        if ( i === 4 ) return [ c, a, v ];
        if ( i === 5 ) return [ v, a, b ];
    })()

    return values.map(v => v*255);
   
} 

class SuggestionsResponseMessageBuilder extends ScrimsMessageBuilder {

    static suggestionBlue = "#5865F2"
    static successGreen = "#0BE468"
    static epicPurple = "#9A00FF"
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


    static suggestionEmbed(hue, suggestion, created_at, creator) {
        return new MessageEmbed()
            .setAuthor({ name: creator.tag, iconURL: creator.displayAvatarURL({ dynamic: true }) })
            .setColor((hue < 0 ? this.epicPurple : hsv2rgb(hue, 1, 1)))
            .setDescription(suggestion)
            .setTimestamp(created_at)
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

module.exports = SuggestionsResponseMessageBuilder;