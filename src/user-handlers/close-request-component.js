const { MessageEmbed, MessageComponentInteraction } = require("discord.js");

async function onComponent(interaction) {

    if (!(interaction instanceof MessageComponentInteraction)) // "Houston, we have a problem"
        return interaction.reply({ content: "How did we get here?", ephemeral: true });

    const handler = getHandler(interaction.args.shift());
    if (!handler) return interaction.reply({ content: "This button does not have a handler. Please refrain from trying again.", ephemeral: true });

    const dbClient = interaction.client.database; // Instance of DBClient created in bot.js
    interaction.ticket = await dbClient.getTicket({ id: interaction.args.shift() })
    if (interaction.ticket === null) return interaction.message.delete() // The ticket no longer exists :/

    await interaction.deferReply({ ephemeral: true });
    return handler(interaction);

}

function getHandler(subCommand) {
    switch (subCommand) {
        case ("DENY"): return onDeny;
        case ("ACCEPT"): return onAccept;
        default: return false;
    }
}

async function onDeny(interaction) {

    const ticketCreatorId = interaction.ticket.userId
    if (ticketCreatorId != interaction.user.id)
        return interaction.editReply(getNotAllowedPayload(ticketCreatorId, interaction.hasPermission("STAFF")));

    const transcriber = interaction.client.transcriber;
    await transcriber.transcribe(
        interaction.ticket.id, { ...interaction, createdTimestamp: interaction.createdTimestamp, content: "denied the close request" }
    ).catch(console.error);

    await interaction.editReply("Close request denied.");
    await interaction.message.edit(getRequestDeniedPayload(interaction.user));

}

async function onAccept(interaction) {

    const ticketCreatorId = interaction.ticket.userId
    if (ticketCreatorId != interaction.user.id)
        return interaction.editReply(getNotAllowedPayload(ticketCreatorId, interaction.hasPermission("STAFF")));

    const transcriber = interaction.client.transcriber; // Instance of TicketTranscriber created in bot.js
    await transcriber.transcribe(
        interaction.ticket.id, { ...interaction, createdTimestamp: interaction.createdTimestamp, content: "accepted the close request" }
    ).catch(console.error);
    await transcriber.send(interaction.guild, interaction.ticket).catch(console.error);

    const dbClient = interaction.client.database; // Instance of DBClient created in bot.js
    await dbClient.deleteTicket(interaction.ticket.id);
    await interaction.channel.delete();

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