const { ContextMenuCommandBuilder } = require('@discordjs/builders');
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

    if (interaction.channel !== interaction.client.suggestions.suggestionChannels[interaction.guild.id])
        return interaction.reply(SuggestionsResponseMessageBuilder.errorMessage("Wrong Channel", "This should only be used in the suggestions channel!"));

    if (interaction instanceof MessageComponentInteraction) return onComponent(interaction);
    if (interaction instanceof MessageContextMenuInteraction) return onContextMenu(interaction);
    if (interaction instanceof ModalSubmitInteraction) return onModalSubmit(interaction);
    
    await interaction.reply({ content: "How did we get here?", ephemeral: true });

}

async function logDanger(interaction, message, error=null) {

    const context = { 

        guild_id: interaction.guild.id, 
        suggestion: interaction.suggestion,
        executor_id: interaction.user.id,
        error

    }

    await interaction.client.suggestions.logError(message, context)

}

async function onError(interaction, action, error, abort) {

    if (abort) {

        if (interaction.replied) await interaction.editReply(SuggestionsResponseMessageBuilder.failedMessage(action))
        else await interaction.reply(SuggestionsResponseMessageBuilder.failedMessage(action))

    }

    await logDanger(interaction, `Unable to ${action} while handling a **${interaction.commandName}** command!`, error)
    return false;

}

async function verifySuggestionRequest(interaction) {

    if (!interaction.scrimsUser)
        return interaction.reply( SuggestionsResponseMessageBuilder.scrimsUserNeededMessage() ).then(() => false);

    const bannedPosition = await interaction.client.database.userPositions.get({ id_user: interaction.scrimsUser.id_user, position: { name: "suggestion_blacklisted" } })
    if (bannedPosition.length > 0) {

        const length = bannedPosition[0].expires_at ? `until <t:${bannedPosition[0].expires_at}:f>` : `permanently`;
        return interaction.reply( 
            SuggestionsResponseMessageBuilder.errorMessage(`Not Allowed`, `You are not allowed to create suggestions ${length} since you didn't follow the rules.`) 
        ).then(() => false);

    }
        
    const cooldown = cooldowns[interaction.userId] ?? null
    if (cooldown && (!(await interaction.member.hasPermission("support")))) {

        return interaction.reply({ 
            content: `You are currently on suggestion cooldown! You can create a suggestion again <t:${Math.round(cooldown/1000)}:R>.`, 
            ephemeral: true 
        }).then(() => false);

    }

    return true;

}

const componentHandlers = { 'create': onSuggestionCreate }
async function onComponent(interaction) {

    const handler = componentHandlers[interaction.args.shift()]
    if (handler) return handler(interaction);

    await interaction.reply({ content: "This button does not have a handler. Please refrain from trying again.", ephemeral: true });

}

async function onSuggestionCreate(interaction) {

    const allowed = await verifySuggestionRequest(interaction)
    if (!allowed) return false;

    await createModal(interaction)

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
    
    interaction.suggestion = suggestion

    const interactorIsAuthor = (suggestion.creator.discord_id == interaction.userId);
    if (suggestion.epic && interactorIsAuthor) 
        return interaction.reply(SuggestionsResponseMessageBuilder.errorMessage("Not Removable", "Since your suggestion is so liked it can not be removed!"));

    if (!(await interaction.member.hasPermission("staff")) && !interactorIsAuthor) 
        return interaction.reply(SuggestionsResponseMessageBuilder.errorMessage("Insufficient Permissions", "You are not allowed to remove this suggestion!"));

    // Remove from cache so that when the message delete event arrives it will not trigger anything
    const removed = interaction.client.database.suggestions.cache.remove({ id_suggestion: suggestion.id_suggestion })

    const response = await interaction.targetMessage.delete().catch(error => onError(interaction, `remove suggestions message`, error, true))
    if (response === false) {

        // Deleting the message failed so add the suggestion back to cache
        removed.forEach(removed => interaction.client.database.suggestions.cache.push(removed))

        return false;

    }

    await interaction.client.database.suggestions.remove({ id_suggestion: suggestion.id_suggestion })
        .catch(error => onError(interaction, `remove suggestion from the database`, error, false))

    await logDanger(interaction, `Removed a suggestion.`)
    
    const message = (interactorIsAuthor) ? `Your suggestion was successfully removed.` : `The suggestion was foribly removed.`
    await interaction.reply({ content: message, ephemeral: true })

}

function addCooldown(userId) {

    cooldowns[userId] = (Date.now() + cooldown)
    setTimeout(() => delete cooldowns[userId], cooldown)

}

async function onModalSubmit(interaction) {

    const allowed = await verifySuggestionRequest(interaction)
    if (!allowed) return false;

    await interaction.deferReply({ ephemeral: true })

    const suggestion = interaction.getTextInputValue('suggestion')

    const embed = SuggestionsResponseMessageBuilder.suggestionEmbed(60, suggestion, interaction.createdTimestamp, interaction.user)
    const message = await interaction.channel.send({ embeds: [embed] }).catch(error => onError(interaction, `send suggestions message`, error, true))
    if (message === false) return false;

    const result = Promise.all(interaction.client.suggestions.getVoteEmojis(interaction.guild).map(emoji => message.react(emoji)))
        .catch(error => onError(interaction, `react to suggestions message`, error, true))

    if (result === false) return message.delete().catch(error => onError(interaction, `delete suggestion message after aborting command`, error, false));

    // Delete the current suggestions info message since it is no longer the last message
    await interaction.client.suggestions.sendSuggestionInfoMessage(interaction.channel, true)

    const newSuggestion = { 

        channel_id: message.channel.id, 
        message_id: message.id, 
        created_at: Math.round(interaction.createdTimestamp/1000),
        suggestion,
        id_creator: interaction.scrimsUser.id_user

    }

    if (!(await interaction.member.hasPermission("support"))) addCooldown(interaction.userId)

    const createResult = await interaction.client.database.suggestions.create(newSuggestion)
        .catch(error => onError(interaction, `add suggestion to database`, error, true))
   
    if (createResult === false) return message.delete().catch(error => onError(interaction, `delete suggestion message after aborting command`, error, false));

    await interaction.editReply(SuggestionsResponseMessageBuilder.suggestionSentMessage());

}

function buildRemoveSuggestionContextMenuCommand() {

    return [ new ContextMenuCommandBuilder().setName("Remove Suggestion").setType(3), {} ];

}

module.exports = {

    interactionHandler: onInteraction,
    commands: [ buildRemoveSuggestionContextMenuCommand() ]

};