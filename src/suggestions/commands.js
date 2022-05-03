const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");

const SuggestionsResponseMessageBuilder = require("./responses");
const ScrimsMessageBuilder = require("../lib/responses");
const ScrimsSuggestion = require("./suggestion");

const commandHandlers = {

    "attach-to-suggestion": suggestionAttachCommand,
    "remove-suggestion": suggestionRemoveCommand,
    "suggestionRemove": suggestionRemoveComponent

}
async function onCommand(interaction) {

    const handler = commandHandlers[interaction.commandName]
    if (handler) {
        
        return handler(interaction);

    }

}

async function getBlacklisted(interaction) {

    const blacklistedPositions = await interaction.client.database.userPositions.get(
        { id_user: interaction.scrimsUser.id_user, position: { name: "suggestion_blacklisted" } }
    )

    return blacklistedPositions[0];

}

/**
 * @param { import('../types').ScrimsCommandInteraction } interaction 
 * @returns { Promise<false | ScrimsSuggestion[]> }
 */
async function getSuggestions(interaction) {

    if (!interaction.scrimsUser) return interaction.reply( ScrimsMessageBuilder.scrimsUserNeededMessage() ).then(() => false);

    const blacklisted = await getBlacklisted(interaction)
    if (blacklisted) {

        const length = blacklisted.expires_at ? `until <t:${blacklisted.expires_at}:f>` : `permanently`;
        return interaction.reply( 
            ScrimsMessageBuilder.errorMessage(`Not Allowed`, `You are not allowed to use suggestions ${length} since you didn't follow the rules.`) 
        ).then(() => false);

    }

    return interaction.client.database.suggestions.get({ id_creator: interaction.scrimsUser.id_user })
        .then(suggestions => suggestions.sort((a, b) => b.created_at - a.created_at));

}

/**
 * @param { import('../types').ScrimsCommandInteraction } interaction 
 */
async function suggestionAttachCommand(interaction) {

    const suggestions = await getSuggestions(interaction)
    if (suggestions === false) return false;
    
    const suggestionsChannel = interaction.client.suggestions.suggestionChannels[interaction?.guild?.id]

    if (suggestions.length === 0) 
        return interaction.reply( ScrimsMessageBuilder.errorMessage(
            'No Suggestions', `You currently have no suggestions created. `
            + (suggestionsChannel ? `To create a suggestion go to the ${suggestionsChannel} and click on the **Make a Suggestion** button. ` : '')
        ));

    const attachmentURL = interaction.options.getAttachment('attachment').proxy_url
    return interaction.reply( SuggestionsResponseMessageBuilder.attachSuggestionConfirmMessage(interaction.client, suggestions.slice(0, 5), { attachmentURL }) );

}

/**
 * @param { import('../types').ScrimsCommandInteraction } interaction 
 */
async function suggestionRemoveCommand(interaction) {

    const suggestions = await getSuggestions(interaction)
    if (suggestions === false) return false;
    
    const removeableSuggestions = suggestions.filter(suggestion => !suggestion.epic)
    const suggestionsChannel = interaction.client.suggestions.suggestionChannels[interaction?.guild?.id]

    if (removeableSuggestions.length === 0) 
        return interaction.reply( ScrimsMessageBuilder.errorMessage(
            'No Removable Suggestions', `You currently have no removable suggestions. `
            + (suggestionsChannel ? `To create a suggestion go to the ${suggestionsChannel} and click on the **Make a Suggestion** button. ` : '')
            + `If your suggestion has a lot of up-votes it may not show up as removable.`
        ));

    return interaction.reply( SuggestionsResponseMessageBuilder.removeSuggestionConfirmMessage(removeableSuggestions.slice(0, 5)) );

}

async function suggestionRemoveComponent(interaction) {

    if (!interaction.scrimsUser) return interaction.reply( ScrimsMessageBuilder.scrimsUserNeededMessage() );

    const blacklisted = await getBlacklisted(interaction)
    if (blacklisted) {

        const length = blacklisted.expires_at ? `until <t:${blacklisted.expires_at}:f>` : `permanently`;
        return interaction.update( 
            ScrimsMessageBuilder.errorMessage(`Not Allowed`, `You are not allowed to use suggestions ${length} since you didn't follow the rules.`) 
        );

    }

    const id_suggestion = interaction.args.shift()
    const suggestion = await interaction.client.database.suggestions.get({ id_suggestion }).then(results => results[0])
    
    if (!suggestion) return interaction.update( 
        ScrimsMessageBuilder.errorMessage(`Unkown Suggestion`, `The suggestion you were trying to delete no longer exists.`) 
    );

    // Remove from cache so that when the message delete event arrives it will not trigger anything
    const removed = interaction.client.database.suggestions.cache.remove({ id_suggestion })

    const message = await suggestion.fetchMessage()
    if (!message) return interaction.update(ScrimsMessageBuilder.failedMessage('remove the suggestion'));

    const response = await message.delete().catch(error => error)
    if (response instanceof Error) {

        // Deleting the message failed so add the suggestion back to cache
        removed.forEach(removed => interaction.client.database.suggestions.cache.push(removed))

        throw response;

    }

    await interaction.client.database.suggestions.remove({ id_suggestion })
        .catch(error => console.error(`Unable to remove a suggestion from the database because of ${error}!`, id_suggestion))

    interaction.client.database.ipc.send('audited_suggestion_remove', { suggestion, executor_id: interaction.user.id })
    
    await interaction.update({ content: `Suggestion successfully removed.`, embeds: [], components: [], ephemeral: true })

}

function buildRemoveCommand() {

    const removeCommand =  new SlashCommandBuilder()
        .setName("remove-suggestion")
        .setDescription("Use this command to remove a suggestion.")

    return [ removeCommand, {} ];

}

function buildAttachCommand() {

    const command = new SlashCommandBuilder()
        .setName("attach-to-suggestion")
        .setDescription("Use this command to atach a file to one of your suggestions.")
        .addAttachmentOption( attachmentOption => (
                attachmentOption 
                    .setName('attachment')
                    .setDescription("The file you would like to attach to a suggestion.")
                    .setRequired(true)
            )
        )
        
    return [ command, {} ];

}

module.exports = {

    commandHandler: onCommand,
    eventListeners: [ "suggestionRemove" ],
    commands: [ buildRemoveCommand() ]

}