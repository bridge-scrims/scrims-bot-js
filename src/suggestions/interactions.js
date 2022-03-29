const { SlashCommandBuilder, ContextMenuCommandBuilder } = require('@discordjs/builders');
const { Modal, TextInputComponent, showModal, ModalSubmitInteraction } = require('discord-modals');
const { MessageComponentInteraction, MessageContextMenuInteraction } = require("discord.js");
const SuggestionsResponseMessageBuilder = require('./responses');

const cooldown = 15*60*1000
const cooldowns = {}

/**
    `suggestion` slash commands, components and `Remove Suggestion` context menus are all handeld here
 */
async function onInteraction(interaction) {

    if (!interaction.guild)
        return interaction.reply(SuggestionsResponseMessageBuilder.errorMessage("Guild Only", "This should only be used in discord servers!"));

    if (interaction.channelId != interaction.client.suggestions.channelId)
        return interaction.reply(SuggestionsResponseMessageBuilder.errorMessage("Wrong Channel", "This should only be used in the suggestions channel!"));

    if (interaction instanceof MessageComponentInteraction) return onComponent(interaction);
    if (interaction instanceof MessageContextMenuInteraction) return onContextMenu(interaction);
    if (interaction instanceof ModalSubmitInteraction) return onModalSubmit(interaction);
    
    return interaction.reply({ content: "How did we get here?", ephemeral: true });
}

const componentHandlers = { 'create': onSuggestionCreate }
async function onComponent(interaction) {
    const handler = componentHandlers[interaction.args.shift()]
    if (handler) return handler(interaction);

    return interaction.reply({ content: "This button does not have a handler. Please refrain from trying again.", ephemeral: true });
}

async function onSuggestionCreate(interaction) {
    const cooldown = cooldowns[interaction.userId] ?? null
    if (cooldown === null) return createModal(interaction)

    return interaction.reply({ 
        content: `You are currently on suggestion cooldown! You can create a suggestion again <t:${Math.round(cooldown/1000)}:R>.`, 
        ephemeral: true 
    });
}

async function createModal(interaction) {
    const modal = new Modal()
        .setCustomId(`suggestion`)
        .setTitle('Suggestion')
        .addComponents(
            new TextInputComponent()
                .setCustomId('suggestion')
                .setLabel('Your brilliant idea')
                .setStyle('LONG') // Text Input Component Style can be 'SHORT' or 'LONG'
                .setMinLength(15)
                .setMaxLength(2000)
                .setPlaceholder('Write here')
                .setRequired(true)
        )

    return showModal(modal, { client: interaction.client, interaction });
}

async function onContextMenu(interaction) {
    return onRemoveSuggestion(interaction);
}

async function onRemoveSuggestion(interaction) {

    if (interaction.targetId == interaction.client.suggestions.suggestionsInfoMessage)
        return interaction.reply({ content: "This should be used on suggestion messages. Not the suggestions channel info message!", ephemeral: true });

    const suggestion = interaction.client.database.suggestions.cache.get({ message_id: interaction.targetId })[0]
    if (!suggestion) return interaction.reply(SuggestionsResponseMessageBuilder.errorMessage("Unkown Suggestion", "This can only be used on suggestion messages!"));

    const interactorIsAuthor = (suggestion.creator.discord_id == interaction.userId);

    if (!interaction.member.hasPermission("staff") && !interactorIsAuthor) 
        return interaction.reply(SuggestionsResponseMessageBuilder.errorMessage("Insufficient Permissions", "You are not allowed to remove this suggestion!"));

    const response = await interaction.targetMessage.delete().catch(error => error)
    if (response instanceof Error) {
        console.error(`Failed to remove suggestion message ${interaction.targetId} after requested by ${interaction.user.tag}!`, error)
        return interaction.reply(SuggestionsResponseMessageBuilder.errorMessage("Remove Failed", "This suggestion could not be removed. Please try again later."));
    }

    await interaction.client.database.suggestions.remove({ id_suggestion: suggestion.id_suggestion }).catch(console.error)
    const content = (interactorIsAuthor) ? `Your suggestion was successfully removed.` : `The suggestion was foribly removed.`
    await interaction.reply({ content: "Suggestion successfully removed.", ephemeral: true });

}

function addCooldown(userId) {

    cooldowns[userId] = (Date.now() + cooldown)
    setTimeout(() => delete cooldowns[userId], cooldown)

}

async function onModalSubmit(interaction) {

    await interaction.deferReply({ ephemeral: true })

    const suggestion = interaction.getTextInputValue('suggestion')

    const embed = SuggestionsResponseMessageBuilder.suggestionEmbed(60, suggestion, interaction.createdTimestamp, interaction.user)
    const message = await interaction.channel.send({ embeds: [embed] }).catch(error => error)
    if (message instanceof Error) {
        console.error(`Unexpected error while adding a suggestion for ${interaction.user.tag}!`, response)
        return interaction.editReply(SuggestionsResponseMessageBuilder.errorMessage("Suggestion Failed", "Sadly your suggestion was not able to be added. Please try again later."));
    }

    Promise.all(interaction.client.suggestions.getVoteEmojis(interaction.guild).map(emoji => message.react(emoji))).catch(console.error)

    // Delete the current suggestions info message since it is no longer the last message
    await interaction.client.suggestions.sendSuggestionInfoMessage(interaction.channel, true).catch(console.error);

    const newSuggestion = { 
        channel_id: message.channel.id, 
        message_id: message.id, 
        created_at: Math.round(interaction.createdTimestamp/1000),
        suggestion,
        creator: { discord_id: interaction.user.id }
    }

    if (!interaction.member.hasPermission("support")) addCooldown(interaction.userId)

    await interaction.client.database.suggestions.create(newSuggestion).catch(console.error)
    return interaction.editReply(SuggestionsResponseMessageBuilder.suggestionSentMessage());

}

function buildRemoveSuggestionContextMenuCommand() {

    return [ new ContextMenuCommandBuilder().setName("Remove Suggestion").setType(3), {} ];

}

module.exports = {

    interactionHandler: onInteraction,
    commands: [ buildRemoveSuggestionContextMenuCommand() ]

};