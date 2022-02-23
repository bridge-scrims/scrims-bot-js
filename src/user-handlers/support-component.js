const { Modal, TextInputComponent, showModal } = require('discord-modals');
const { SnowflakeUtil } = require("discord.js");

async function onComponent(interaction) {

    if (!interaction?.isMessageComponent()) // "Houston, we have a problem"
        return interaction.reply({ content: "How did we get here?", ephemeral: true });

    await createModal(interaction)

}

async function createModal(interaction) {
    const modal = new Modal() // We create a Modal
        .setCustomId(`support/${SnowflakeUtil.generate()}`)
        .setTitle('Support Ticket')
        .addComponents(
            new TextInputComponent() // We create an Text Input Component
                .setCustomId('request-reason')
                .setLabel('Reason for opening a ticket')
                .setStyle('LONG') //IMPORTANT: Text Input Component Style can be 'SHORT' or 'LONG'
                .setMinLength(5)
                .setMaxLength(2000)
                .setPlaceholder('Write here')
                .setRequired(true) // If it's required or not
                .setValue('value')
        );
    return showModal(modal, { client: interaction.client, interaction });
}

module.exports = onComponent;