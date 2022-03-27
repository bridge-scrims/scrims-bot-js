const { Modal, TextInputComponent, showModal } = require('discord-modals');


const componentHandlers = { "support": createModal, "TicketCloseRequest": onCloseRequest }
async function onComponent(interaction) {

    const handler = componentHandlers[interaction.commandName]
    if (handler) {

        if (!interaction.guild) return interaction.reply(ScrimsMessageBuilder.guildOnlyMessage());

        return handler(interaction).catch(console.error);

    }

}


async function createModal(interaction) {
    const modal = new Modal()
        .setCustomId(`support-modal`)
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

    interaction.ticket = interaction.client.database.tickets.cache.get({ id_ticket: interaction.args.shift() })[0]
    
    // The ticket no longer exists :/
    if (!interaction.ticket) return interaction.message.delete().catch(() => { /* Message could already be deleted */ }) 

    await interaction.deferReply({ ephemeral: true }); // Inform the user that the bot needs to do some thinking
    return handler(interaction);

}

async function onDeny(interaction) {

    const ticketCreatorId = interaction.ticket.user.discord_id;
    if (ticketCreatorId != interaction.userId)
        return interaction.editReply(getNotAllowedPayload(ticketCreatorId, interaction.member.hasPermission("staff")));

    const transcriber = interaction.client.transcriber;
    const message = { ...interaction, createdTimestamp: interaction.createdTimestamp, author: interaction.user, content: "denied the close request" }
    await transcriber.transcribe(interaction.ticket.id_ticket, message).catch(console.error); // Command should not abort just because the event was not logged

    await interaction.editReply("Close request denied.");
    await interaction.message.edit(getRequestDeniedPayload(interaction.user));

}

async function onAccept(interaction) {

    const ticketCreatorId = interaction.ticket.user.discord_id;
    if (ticketCreatorId != interaction.userId)
        return interaction.editReply(getNotAllowedPayload(ticketCreatorId, interaction.member.hasPermission("staff")));

    const transcriber = interaction.client.transcriber;
    const message = { ...interaction, createdTimestamp: interaction.createdTimestamp, author: interaction.user, content: "accepted the close request" }
    await transcriber.transcribe(interaction.ticket.id_ticket, message).catch(console.error); // Command should not abort just because the event was not logged
    await transcriber.send(interaction.guild, interaction.ticket).catch(console.error); // Command should not abort just because their was an error with the log

    await interaction.client.database.tickets.remove({ id_ticket: interaction.ticket.id_ticket })
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