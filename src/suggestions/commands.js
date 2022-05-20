const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const { SlashCommandBuilder, SlashCommandSubcommandGroupBuilder, SlashCommandSubcommandBuilder } = require("@discordjs/builders");

const SuggestionsResponseMessageBuilder = require("./responses");
const ScrimsMessageBuilder = require("../lib/responses");
const ScrimsSuggestion = require("./suggestion");

const commandHandlers = {

    "suggestions": onSuggestionCommand,
    //"suggestionAttach": suggestionAttachComponent,
    //"suggestionDeattach":suggestionDeattachComponent,
    "suggestionRemove": suggestionRemoveComponent

}
async function onCommand(interaction) {

    const handler = commandHandlers[interaction.commandName]
    if (handler) return handler(interaction);

    throw new Error(`Interaction with name '${interaction.commandName}' does not have a handler!`, commandHandlers);

}

const suggestionCommandHandlers = {

    //"attach": suggestionAttachCommand,
    "remove": suggestionRemoveCommand,
    //"detach": suggestionDetachCommand

}
async function onSuggestionCommand(interaction) {

    const handler = suggestionCommandHandlers[interaction.options.getSubcommand()]
    if (handler) return handler(interaction);

    throw new Error(`Interaction with subcommand '${interaction.options.getSubcommand()}' does not have a handler!`, suggestionCommandHandlers);

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
async function suggestionDetachCommand(interaction) {

    const suggestions = await getSuggestions(interaction)
    if (suggestions === false) return false;

    const suggestionsChannel = interaction.client.suggestions.suggestionChannels[interaction?.guild?.id]

    if (suggestions.length === 0) 
        return interaction.reply( ScrimsMessageBuilder.errorMessage(
            'No Suggestions', `You currently have no suggestions created. `
            + (suggestionsChannel ? `To create a suggestion go to the ${suggestionsChannel} and click on the **Make a Suggestion** button. ` : '')
        ));

    const attachedSuggestions = suggestions.filter(suggestion => suggestion.attachmentURL)
    if (attachedSuggestions.length === 0) {
        return interaction.reply( ScrimsMessageBuilder.errorMessage(
            'No Suggestions', `You currently have no suggestions with an attachment. `
                + `To add a attachment run this command again, but pass through a file you would like to add.`
        ));
    }

    await interaction.reply( SuggestionsResponseMessageBuilder.deattachSuggestionConfirmMessage(attachedSuggestions.slice(0, 5)) )

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

    const attachment = interaction.options.getAttachment('attachment')

    const scrimsAttachmentData = { attachment_id: `_${attachment.id}`, filename: attachment.name, content_type: attachment.contentType, url: attachment.url }
    await interaction.client.database.attachments.create(scrimsAttachmentData)

    setTimeout(() => interaction.client.database.attachments.remove({ attachment_id: `_${attachment.id}` }).catch(console.error), 15*60*1000)
    await interaction.reply( SuggestionsResponseMessageBuilder.attachSuggestionConfirmMessage(suggestions.slice(0, 5), attachment) )

}

/**
 * @param { import('../types').ScrimsComponentInteraction } interaction 
 */
 async function suggestionDeattachComponent(interaction) {

    const id_suggestion = interaction.args.shift()
    const suggestion = interaction.client.database.suggestions.cache.resolve(id_suggestion)
    if (!suggestion) 
        return interaction.update(SuggestionsResponseMessageBuilder.errorMessage('Unknown Suggestion', `That suggestion does not exist anymore.`));

    await interaction.client.database.suggestions.update({ id_suggestion }, { attachment_id: null })

    const message = await suggestion.fetchMessage()
    await message.edit({ embeds: [message.embeds[0].setImage(null) ] })

    await interaction.update({ content: `Attachment successfully removed.`, embeds: [], components: [] })

}

/**
 * @param { import('../types').ScrimsComponentInteraction } interaction 
 */
async function suggestionAttachComponent(interaction) {

    const id_suggestion = interaction.args.shift()
    const suggestion = interaction.client.database.suggestions.cache.resolve(id_suggestion)
    if (!suggestion) 
        return interaction.update(SuggestionsResponseMessageBuilder.errorMessage('Unknown Suggestion', `That suggestion does not exist anymore.`));

    const attachment_id = interaction.args.shift()
    const attachment = interaction.client.database.attachments.cache.resolve(`_${attachment_id}`)
    if (!attachment) 
        return interaction.update(SuggestionsResponseMessageBuilder.errorMessage('Unknown Attachment', `That attachment does not exist anymore.`));

    if (!interaction.client.database.attachments.cache.resolve(attachment_id))
        await interaction.client.database.attachments.create({ ...attachment.toMinimalForm(), attachment_id })
    
    await interaction.client.database.suggestions.update({ id_suggestion }, { attachment_id })

    const message = await suggestion.fetchMessage()
    await message.edit({ embeds: [message.embeds[0].setImage(attachment.url) ] })

    await interaction.update({ content: `Attachment successfully added.`, embeds: [], components: [] })

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
    const removed = interaction.client.database.suggestions.cache.remove(id_suggestion)

    const message = await suggestion.fetchMessage()
    if (!message) return interaction.update(ScrimsMessageBuilder.failedMessage('remove the suggestion'));

    const response = await message.delete().catch(error => error)
    if (response instanceof Error) {

        // Deleting the message failed so add the suggestion back to cache
        interaction.client.database.suggestions.cache.push(removed)

        throw response;

    }

    await interaction.client.database.suggestions.remove({ id_suggestion })
        .catch(error => console.error(`Unable to remove a suggestion from the database because of ${error}!`, id_suggestion))

    interaction.client.database.ipc.send('audited_suggestion_remove', { suggestion, executor_id: interaction.user.id })
    
    await interaction.update({ content: `Suggestion successfully removed.`, embeds: [], components: [], ephemeral: true })

}

function getRemoveSubcommand() {

    return new SlashCommandSubcommandBuilder()
        .setName("remove")
        .setDescription("Use this command to remove a suggestion.")

}

function getAttachSubcommand() {

    return new SlashCommandSubcommandBuilder()
        .setName("attach")
        .setDescription("Use this command to atach a file to one of your suggestions.")
        .addAttachmentOption( attachmentOption => (
                attachmentOption 
                    .setName('attachment')
                    .setDescription("The file you would like to attach to a suggestion.")
                    .setRequired(true)
            )
        ) 

}

function getDetachSubcommand() {

    return new SlashCommandSubcommandBuilder()
        .setName("detach")
        .setDescription("Use this command to detach a file from one of your suggestions.")

}

function buildSuggestionCommandGroup() {

    const group = new SlashCommandSubcommandGroupBuilder()
        .setName('suggestions')
        .setDescription('Commands used to do stuff with suggestions.')
        .addSubcommand( getRemoveSubcommand() )
        //.addSubcommand( getAttachSubcommand() )
        //.addSubcommand( getDetachSubcommand() )

    return [ group, {}, { forceGuild: false, bypassBlock: false, forceScrimsUser: true } ];

}

module.exports = {

    commandHandler: onCommand,
    eventListeners: [ "suggestionRemove", "suggestionAttach", "suggestionDeattach" ],
    commands: [ buildSuggestionCommandGroup() ]

}