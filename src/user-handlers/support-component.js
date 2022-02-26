const { SnowflakeUtil, MessageComponentInteraction } = require("discord.js");
const { Modal, TextInputComponent, showModal } = require('discord-modals');

async function onComponent(interaction) {

    if (!(interaction instanceof MessageComponentInteraction)) // "Houston, we have a problem"
        return interaction.reply({ content: "How did we get here?", ephemeral: true });

    await createModal(interaction)

}

async function createModal(interaction) {
    const modal = new Modal()
        .setCustomId(`support-modal/${SnowflakeUtil.generate()}`)
        .setTitle('Support Ticket')
        .addComponents(
            new TextInputComponent()
                .setCustomId('request-reason')
                .setLabel('Reason for opening a ticket')
                .setStyle('LONG') // Text Input Component Style can be 'SHORT' or 'LONG'
                .setMinLength(5)
                .setMaxLength(2000)
                .setPlaceholder('Write here')
                .setRequired(true)
        );
    return showModal(modal, { client: interaction.client, interaction });
}

module.exports = onComponent;