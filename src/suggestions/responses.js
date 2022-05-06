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
        return {

            embeds: [
                new MessageEmbed()
                    .setColor(this.successGreen)
                    .setTitle("Suggestion Sent")
                    .setDescription(
                        "Your suggestion was successfully created! "
                            + `To remove it use the **/remove-suggestion** command in any channel and pick this suggestion.`
                    )
            ],

            ephemeral: true

        }
    }

    static getSuggestionFields(suggestions) {

        return suggestions.map((suggestion, idx) => {

            const suggestionInfo = `**Created <t:${suggestion?.created_at}:R>:**`
            const suggestionText = suggestion?.suggestion?.substring(0, 1024 - suggestionInfo.length - 25) ?? `Unknown Suggestion.`

            return {
                name: `${idx+1}. Suggestion`,
                value: `${suggestionInfo}\n\`\`\`\n${suggestionText}`
                    + `${(suggestion?.suggestion && (suggestionText.length !== suggestion.suggestion.length)) ? "\n..." : ""}\`\`\``,
                inline: false
            };

        })

    }

    static getSuggestionButtons(suggestions) {

        return suggestions.map((suggestion, idx) => (

            new MessageButton()
                .setLabel(`Remove ${idx+1}.`)
                .setCustomId(`suggestionRemove/${suggestion.id_suggestion}`)
                .setStyle('DANGER')

        ))

    }

    static removeSuggestionConfirmMessage(suggestions) {

        return {

            embeds: [

                new MessageEmbed()
                    .setColor('#FF255F')
                    .setTitle("Remove Suggestion")
                    .setDescription(`Please confirm which suggestion you would like to remove.`)
                    .addFields(this.getSuggestionFields(suggestions))

            ],

            components: [

                new MessageActionRow().addComponents(this.getSuggestionButtons(suggestions)),
                new MessageActionRow().addComponents(this.cancelButton())

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