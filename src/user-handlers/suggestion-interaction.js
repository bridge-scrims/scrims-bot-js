const { Modal, TextInputComponent, showModal, ModalSubmitInteraction } = require('discord-modals');
const { MessageComponentInteraction, MessageContextMenuInteraction } = require("discord.js");
const ResponseTemplates = require('../response-templates');

const cooldown = 15*60*1000
const cooldowns = {}

async function onInteraction(interaction) {

    if (interaction.channelId != interaction.client.suggestionsChannelId)
        return interaction.reply(ResponseTemplates.errorMessage("Wrong Channel", "This should only be used in the suggestions channel!"));

    if (interaction instanceof MessageComponentInteraction) return onComponent(interaction);
    if (interaction instanceof MessageContextMenuInteraction) return onContextMenu(interaction);
    if (interaction instanceof ModalSubmitInteraction) return onModalSubmit(interaction);
    
    return interaction.reply({ content: "How did we get here?", ephemeral: true });
}

async function onComponent(interaction) {
    const handlerId = interaction.args.shift()
    if (handlerId == 'create') return onSuggestionCreate(interaction);

    return interaction.reply({ content: "This button does not have a handler. Please refrain from trying again.", ephemeral: true });
}

async function onSuggestionCreate(interaction) {
    const cooldown = cooldowns[interaction.userId] ?? null
    if (cooldown === null) return createModal(interaction)

    return interaction.reply({ 
        content: `You are currently on suggestion cooldown! You can create a suggestion again <t:${Math.round(cooldowns[interaction.userId]/1000)}:R>.`, 
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
        );
    return showModal(modal, { client: interaction.client, interaction });
}

function addCooldown(userId) {
    cooldowns[userId] = (Date.now() + cooldown)
    setTimeout(() => delete cooldowns[userId], cooldown)
}

async function onModalSubmit(interaction) {
    await interaction.deferReply({ ephemeral: true })

    const suggestion = interaction.getTextInputValue('suggestion')

    const creator = { userId: interaction.userId, creatorAvatar: interaction.user.avatarURL({ dynamic: true }), creator: interaction.user.tag }
    const embed = ResponseTemplates.suggestionEmbed(60, { ...creator, suggestion })
    const response = await interaction.channel.send({ embeds: [embed] }).catch(error => error)
    if (response instanceof Error) {
        console.error(`Unexpected error while adding a suggestion for ${interaction.user.tag}!`, response)
        return interaction.editReply(ResponseTemplates.errorMessage("Suggestion Failed", "Sadly your suggestion was not able to be added. Please try again later."));
    }

    Promise.all([interaction.client.suggestionUpVote, interaction.client.suggestionDownVote].map(emoji => response.react(emoji))).catch(console.error)

    // Delete the current suggestions info message since it is no longer the last message
    await interaction.client?.suggestionsInfoMessage?.delete()?.catch(console.error);

    addCooldown(interaction.userId)
    const success = await interaction.client.database.createSuggestion(response, creator, suggestion).then(() => true).catch(console.error)
    return interaction.editReply(ResponseTemplates.suggestionSentMessage((success === true)));
}

async function onContextMenu(interaction) {
    if (interaction.commandName === 'Remove Suggestion') return onRemoveSuggestion(interaction);
    return interaction.reply({ content: "This context menu does not have a handler. Please refrain from trying again.", ephemeral: true });
}

async function onRemoveSuggestion(interaction) {

    if (interaction.targetId == interaction.client?.suggestionsInfoMessage)
        return interaction.reply({ content: "This should be used on suggestion messages. Not the suggestions channel info message!", ephemeral: true });

    const suggestion = interaction.client.database.getSuggestion(interaction.targetId)
    if (!suggestion) return interaction.reply(ResponseTemplates.errorMessage("Unkown Suggestion", "This can only be used on suggestion messages!"));

    if (!interaction.member.hasPermission("STAFF") && !(suggestion.userId == interaction.userId)) 
        return interaction.reply(ResponseTemplates.errorMessage("Insufficient Permissions", "You are not allowed to remove this suggestion!"));

    const response = await interaction.targetMessage.delete().catch(error => error)
    if (response instanceof Error) {
        console.error(`Failed to remove suggestion message ${interaction.targetId} after requested by ${interaction.user.tag}!`, error)
        return interaction.reply(ResponseTemplates.errorMessage("Remove Failed", "This suggestion could not be removed. Please try again later."));
    }
    await interaction.client.database.removeSuggestion(suggestion.id).catch(console.error)
    return interaction.reply({ content: "Suggestion successfully removed.", ephemeral: true });

}

module.exports = onInteraction;