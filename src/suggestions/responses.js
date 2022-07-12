const { MessageEmbed, MessageActionRow, MessageButton, MessageSelectMenu, MessageAttachment, BaseMessageComponent } = require("discord.js");
const ScrimsMessageBuilder = require("../lib/responses");

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
                    .setCustomId(`suggestionCreate/create`)
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
                            + `To remove it use the **/suggestions remove** command in any channel and pick this suggestion.`
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

    static removeSuggestionConfirmMessage(suggestions) {

        return {

            embeds: [
                new MessageEmbed()
                    .setColor('#FF255F')
                    .setTitle("Remove Suggestion")
                    .setDescription(`Please confirm which suggestion you would like to remove.`)
                    .addFields(this.getSuggestionFields(suggestions))
            ],
            components: [new MessageActionRow().addComponents(this.getSuggestionRemoveButtons(suggestions)).addComponents(this.cancelButton())],
            ephemeral: true

        }

    }

    static getSuggestionRemoveButtons(suggestions) {

        return suggestions.map((suggestion, idx) => (

            new MessageButton()
                .setLabel(`${idx+1}`)
                .setEmoji("💣")
                .setCustomId(`suggestionRemove/${suggestion.id_suggestion}`)
                .setStyle('DANGER')

        ))

    }

    static getSuggestionAttachButtons(suggestions, attachment_id) {

        return suggestions.map((suggestion, idx) => (

            new MessageButton()
                .setLabel(`${idx+1}.`)
                .setCustomId(`suggestionAttach/${suggestion.id_suggestion}/${attachment_id}`)
                .setStyle('PRIMARY')

        ))

    }

    static getSuggestionDeattachButtons(suggestions) {

        return suggestions.map((suggestion, idx) => (

            new MessageButton()
                .setLabel(`Detach from ${idx+1}.`)
                .setCustomId(`suggestionDeattach/${suggestion.id_suggestion}`)
                .setStyle('DANGER')

        ))

    }

    static deattachSuggestionConfirmMessage(suggestions) {

        return {

            embeds: [

                new MessageEmbed()
                    .setColor('#ff809f')
                    .setTitle("Remove Attachments from Suggestion")
                    .setDescription(`Please confirm which suggestion you would like to remove the attachment of.`)
                    .addFields(this.getSuggestionFields(suggestions))

            ],

            components: [

                new MessageActionRow().addComponents(this.getSuggestionDeattachButtons(suggestions)),
                new MessageActionRow().addComponents(this.cancelButton())

            ],

            ephemeral: true

        }

    }

    static attachSuggestionConfirmMessage(suggestions, attachment) {

        return {

            embeds: [

                new MessageEmbed()
                    .setColor('#80c3ff')
                    .setTitle("Add Attachment to Suggestion")
                    .setDescription(
                        `Please confirm which suggestion you would like to add this attachment to. `
                        + `This attachment will override any attachments previously added to the chosen suggestion.`
                    )
                    .addFields(this.getSuggestionFields(suggestions))
                    .setImage(attachment.url)

            ],

            components: [

                new MessageActionRow().addComponents(this.getSuggestionAttachButtons(suggestions, attachment.id)),
                new MessageActionRow().addComponents(this.cancelButton())

            ],

            ephemeral: true

        }

    }

    static suggestionEmbed(hue, suggestion) {
        return new MessageEmbed()
            .setAuthor({ name: suggestion?.creator?.tag || 'Unknown User', iconURL: suggestion?.creator?.avatarURL() })
            .setColor((hue < 0 ? this.epicPurple : this.hsv2rgb(hue, 1, 1)))
            .setDescription(suggestion.suggestion)
            .setTimestamp(suggestion.created_at*1000)
            .setImage(suggestion.attachmentURL)
    }
    
}

module.exports = SuggestionsResponseMessageBuilder;