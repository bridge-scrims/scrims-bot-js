const { Modal, TextInputComponent, showModal } = require('discord-modals');
const { SnowflakeUtil } = require("discord.js");


const componentHandlers = { "support": createModal, "ticketCloseRequest": onCloseRequest }
async function onComponent(interaction) {

    const handler = componentHandlers[interaction.commandName]
    if (handler) return handler(interaction).catch(console.error);

}


async function createModal(interaction) {
    const modal = new Modal()
        .setCustomId(`support-modal/${SnowflakeUtil.generate()}`)
        .setTitle('Support Ticket')
        .addComponents(
            new TextInputComponent()
                .setCustomId('request-reason')
                .setLabel('Reason for opening a ticket')
                .setStyle('LONG')
                .setMinLength(5)
                .setMaxLength(2000)
                .setPlaceholder('Write here')
                .setRequired(true)
        )

    return showModal(modal, { client: interaction.client, interaction });
}



const closeRequestHandlers = { "ACCEPT": onAccept, "DENY": onDeny }
async function onCloseRequest(interaction) {

    const handler = closeRequestHandlers[interaction.args.shift()];
    if (!handler) return interaction.reply({ content: "This button does not have a handler. Please refrain from trying again.", ephemeral: true });

    const ticketClient = interaction.client.database.tickets; // Instance of DBClient created in bot.js
    interaction.ticket = await ticketClient.get({ id: interaction.args.shift() })
    if (interaction.ticket === null) return interaction.message.delete() // The ticket no longer exists :/

    await interaction.deferReply({ ephemeral: true }); // Inform the user that the bot needs to do some thinking
    return handler(interaction);

}

async function onDeny(interaction) {

    const ticketCreatorId = interaction.ticket.userId
    if (ticketCreatorId != interaction.userId)
        return interaction.editReply(getNotAllowedPayload(ticketCreatorId, interaction.member.hasPermission("STAFF")));

    const transcriber = interaction.client.transcriber;
    await transcriber.transcribe(
        interaction.ticket.id, { ...interaction, createdTimestamp: interaction.createdTimestamp, content: "denied the close request" }
    ).catch(console.error);

    await interaction.editReply("Close request denied.");
    await interaction.message.edit(getRequestDeniedPayload(interaction.user));

}

async function onAccept(interaction) {

    const ticketCreatorId = interaction.ticket.userId
    if (ticketCreatorId != interaction.user.Id)
        return interaction.editReply(getNotAllowedPayload(ticketCreatorId, interaction.member.hasPermission("STAFF")));

    const transcriber = interaction.client.transcriber; // Instance of TicketTranscriber created in bot.js
    await transcriber.transcribe(
        interaction.ticket.id, { ...interaction, createdTimestamp: interaction.createdTimestamp, content: "accepted the close request" }
    ).catch(console.error); // Command should not abort just because the event was not logged
    await transcriber.send(interaction.guild, interaction.ticket).catch(console.error); // Command should not abort just because their was an error with the log

    const ticketTable = interaction.client.database.tickets; // Instance of DBClient created in bot.js
    await ticketTable.remove(interaction.ticket.id)
    await interaction.channel.delete()

}

function getNotAllowedPayload(ticketCreatorId, isStaffMember) {
    const embed = new MessageEmbed()
        .setColor("#2F3136")
        .setTitle(`Error`)
        .setDescription(
            `Only <@${ticketCreatorId}> can close this ticket.` 
            + (isStaffMember ? ` Since you are part of the staff team you could force close this ticket with the **/forceclose** command.` : ``)
        ).setTimestamp();

    return { embeds: [embed] };
}

function getRequestDeniedPayload(user) {
    const embed = new MessageEmbed()
        .setColor("#ff2445")
        .setTitle(`Close Request Denied`)
        .setDescription(`${user} has denied the close request.`)
        .setTimestamp();

    return { content: null, embeds: [embed], components: [] };
}

module.exports = onComponent;