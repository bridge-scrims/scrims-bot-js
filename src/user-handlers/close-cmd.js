const { MessageEmbed, MessageActionRow, MessageButton, CommandInteraction } = require("discord.js");

async function onCommand(interaction) {

    if (!(interaction instanceof CommandInteraction)) // "Houston, we have a problem"
        return interaction.reply({ content: "How did we get here?", ephemeral: true });

    return onClose(interaction);

}

async function onClose(interaction) {

    const reason = interaction.options.getString('reason') ?? "No reason provided.";
    
    const dbClient = interaction.client.database; // Instance of DBClient created in bot.js
    const ticket = await dbClient.getTicket({ channelId: interaction.channel.id })

    if (ticket === null) return interaction.reply(getMissingTicketPayload()); // This is no ticket channel (bruh moment)
    
    await interaction.reply(getCloseRequestPayload(interaction.user, reason, ticket)) // Close request sent and is awaiting aproval!

}

function getCloseRequestActions(ticketId) {
    return new MessageActionRow()
        .addComponents(
            new MessageButton()
            .setCustomId(`TicketCloseRequest/ACCEPT/${ticketId}`)
            .setLabel("✅ Accept & Close")
            .setStyle("PRIMARY")
        ).addComponents(
            new MessageButton()
            .setCustomId(`TicketCloseRequest/DENY/${ticketId}`)
            .setLabel("❌ Deny & Keep Open")
            .setStyle("PRIMARY")
        );
}

function getCloseRequestPayload(user, reason, ticket) {
    const embed = new MessageEmbed()
        .setColor("#5D9ACF")
        .setTitle("Close Request")
        .addField("Reason", `\`\`\`${reason}\`\`\``, false)
        .setDescription(
            `${user} has requested to close this ticket. `
            + `Please accept or deny using the buttons below.`
        ).setTimestamp();

    return { content: `<@${ticket.userId}>`, embeds: [embed], components: [ getCloseRequestActions(ticket.id) ] };
}

function getMissingTicketPayload() {
    const embed = new MessageEmbed()
        .setColor("#FF2445")
        .setTitle("Error")
        .setDescription("This isn't a ticket channel!")
        .setTimestamp();

    return { embeds: [embed], ephemeral: true };
}

module.exports = onCommand;