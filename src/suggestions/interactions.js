const { ContextMenuCommandBuilder } = require('@discordjs/builders');
const { MessageComponentInteraction, MessageContextMenuInteraction, ModalSubmitInteraction, Modal, TextInputComponent, MessageActionRow } = require("discord.js");
const SuggestionsResponseMessageBuilder = require('./responses');
const ScrimsSuggestion = require('../lib/scrims/suggestion');

const cooldown = 15*60*1000
const cooldowns = {}

/**
    `suggestion` slash commands, components and `Remove Suggestion` context menus are all handeld here
 */
async function onInteraction(interaction) {

    if (!interaction.guild) return interaction.reply(SuggestionsResponseMessageBuilder.guildOnlyMessage(interaction.i18n));

    if (interaction.channel !== interaction.client.suggestions.suggestionChannels[interaction.guild.id])
        return interaction.reply(SuggestionsResponseMessageBuilder.errorMessage("Wrong Channel", "This should only be used in the suggestions channel!"));

    if (interaction instanceof MessageComponentInteraction) return onComponent(interaction);
    if (interaction instanceof MessageContextMenuInteraction) return onContextMenu(interaction);
    if (interaction instanceof ModalSubmitInteraction) return onModalSubmit(interaction);
    
    throw new Error(`Interaction with type '${interaction?.constructor?.name}' does not have a handler!`);

}

async function onError(interaction, action, error, abort) {

    if (abort) {

        if (interaction.replied || interaction.deferred) await interaction.editReply(SuggestionsResponseMessageBuilder.failedMessage(action))
        else await interaction.reply(SuggestionsResponseMessageBuilder.failedMessage(action))

    }

    await interaction.client.suggestions.logError(
        `Unable to ${action} while handling a **${interaction.commandName}** command!`, 
        { guild_id: interaction.guild.id, executor_id: interaction.user.id, error }
    )

    return false;

}

async function verifySuggestionRequest(interaction) {

    if (!interaction.scrimsUser)
        return interaction.reply( SuggestionsResponseMessageBuilder.scrimsUserNeededMessage() ).then(() => false);

    const bannedPosition = await interaction.client.database.userPositions.find({ id_user: interaction.scrimsUser.id_user, position: { name: "suggestion_blacklisted" } })
    if (bannedPosition) {

        return interaction.reply( 
            SuggestionsResponseMessageBuilder.errorMessage(`Blacklisted`, `You are not allowed to create suggestions ${bannedPosition.getDuration()} since you didn't follow the rules.`) 
        ).then(() => false);

    }
        
    const cooldown = cooldowns[interaction.userId] ?? null
    if (cooldown && (!(interaction.member.hasPermission("support")))) {

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
            new MessageActionRow().addComponents(
                new TextInputComponent()
                    .setCustomId('suggestion')
                    .setLabel(`What would you like to suggest?`)
                    .setStyle('PARAGRAPH')
                    .setMinLength(10)
                    .setMaxLength(1200)
                    .setPlaceholder('Write here')
                    .setRequired(true)
            )    
        )

    await interaction.showModal(modal)

}

async function onContextMenu(interaction) {

    return onRemoveSuggestion(interaction);
    
}

async function onRemoveSuggestion(interaction) {

    if (interaction.targetId === interaction.client.suggestions.suggestionsInfoMessage)
        return interaction.reply({ content: "This should be used on suggestion messages. Not the suggestions channel info message!", ephemeral: true });

    const suggestion = interaction.client.database.suggestions.cache.find({ message_id: interaction.targetId })
    if (!suggestion) return interaction.reply(SuggestionsResponseMessageBuilder.errorMessage("Unkown Suggestion", "This can only be used on suggestion messages!"));
    
    interaction.suggestion = suggestion

    const interactorIsAuthor = (suggestion.creator.discord_id === interaction.userId);
    if (suggestion.epic && interactorIsAuthor) 
        return interaction.reply(SuggestionsResponseMessageBuilder.errorMessage("Not Removable", "Since your suggestion is so liked it can not be removed! Have a nice day :)"));

    if (!(interaction.member.hasPermission("staff")) && !interactorIsAuthor) 
        return interaction.reply(SuggestionsResponseMessageBuilder.errorMessage("Insufficient Permissions", "You are not allowed to remove this suggestion!"));

    // Remove from cache so that when the message delete event arrives it will not trigger anything
    const removed = interaction.client.database.suggestions.cache.remove(suggestion.id_suggestion)

    const response = await interaction.targetMessage.delete().then(() => true).catch(error => onError(interaction, `remove suggestions message`, error, true))
    if (response !== true) {

        // Deleting the message failed so add the suggestion back to cache
        interaction.client.database.suggestions.cache.push(removed)
        return false;

    }

    await interaction.client.database.suggestions.remove({ id_suggestion: suggestion.id_suggestion })
        .catch(error => onError(interaction, `remove suggestion from the database`, error, false))

    interaction.client.database.ipc.send('audited_suggestion_remove', { suggestion, executor_id: interaction.user.id })
    
    const message = (interactorIsAuthor) ? `Your suggestion was successfully removed.` : `The suggestion was foribly removed.`
    await interaction.reply({ content: message, ephemeral: true })

}

function addCooldown(userId) {

    cooldowns[userId] = (Date.now() + cooldown)
    setTimeout(() => delete cooldowns[userId], cooldown)

}

function getSuggestionText(text) {

    while (text.includes("\n\n\n")) 
        text = text.replace("\n\n\n", "\n\n");

    const lines = text.split("\n")
    if (lines.length > 10)
        text = lines.slice(0, lines.length-(lines.length-10)).join("\n") + lines.slice(lines.length-(lines.length-10)).join(" ")

    return text;

}

/**
 * @param { import('../types').ScrimsModalSubmitInteraction } interaction 
 */
async function onModalSubmit(interaction) {

    const allowed = await verifySuggestionRequest(interaction)
    if (!allowed) return false;

    await interaction.deferReply({ ephemeral: true })

    const inputValue = interaction.fields.getTextInputValue('suggestion')
    if (typeof inputValue !== 'string') return interaction.editReply(SuggestionsResponseMessageBuilder.errorMessage('Invalid Suggestion', "You suggestion must contain at least 15 letters to be valid."));
    const suggestionText = getSuggestionText(inputValue)

    const suggestion = new ScrimsSuggestion(interaction.client.database)
        .setGuild(interaction.guild).setCreation().setSuggestion(suggestionText).setCreator(interaction.scrimsUser)

    const embed = SuggestionsResponseMessageBuilder.suggestionEmbed(60, suggestion)
    const message = await interaction.channel.send({ embeds: [embed] }).catch(error => onError(interaction, `send suggestions message`, error, true))
    if (message === false) return false;

    const result = await Promise.all(interaction.client.suggestions.getVoteEmojis(interaction.guild).map(emoji => message.react(emoji)))
        .catch(error => onError(interaction, `react to suggestions message`, error, true))

    if (result === false) return message.delete().catch(error => onError(interaction, `delete suggestion message after aborting command`, error, false));

    // Delete the current suggestions info message since it is no longer the last message
    await interaction.client.suggestions.sendSuggestionInfoMessage(interaction.channel, true)

    suggestion.setChannel(message.channel)
    suggestion.setMessage(message)

    if (!(interaction.member.hasPermission("staff"))) addCooldown(interaction.userId)

    const createResult = await interaction.client.database.suggestions.create(suggestion)
        .catch(error => onError(interaction, `add suggestion to database`, error, true))
   
    if (createResult === false) return message.delete().catch(error => onError(interaction, `delete suggestion message after aborting command`, error, false));

    //await message.startThread({ name: "Discuss" }).catch(console.error)
    await interaction.editReply(SuggestionsResponseMessageBuilder.suggestionSentMessage());

}

function buildRemoveSuggestionContextMenuCommand() {

    return [ 
        new ContextMenuCommandBuilder().setName("Remove Suggestion").setType(3), 
        {},
        { forceGuild: true, bypassBlock: false, forceScrimsUser: false }
    ];

}

module.exports = {

    interactionHandler: onInteraction,
    listeners: ["suggestion"],
    contextMenus: [ buildRemoveSuggestionContextMenuCommand() ]

};