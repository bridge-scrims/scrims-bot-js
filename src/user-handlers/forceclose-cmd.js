const { MessageEmbed } = require("discord.js");

async function onCommand(interaction) {

    if (!interaction?.isCommand()) // "Houston, we have a problem"
        return interaction.reply({ content: "How did we get here?", ephemeral: true });

    if (!interaction.fromSupport) return interaction.reply(getMissingPermissionPayload()); // Get outa here

    const dbClient = interaction.client.database; // Instance of DBClient created in bot.js
    const ticket = await dbClient.getTicket({ channelId: interaction.channel.id })
    if (ticket === null) return interaction.reply(getMissingTicketPayload()); // This is not a ticket channel (bruh moment)
    
    await dbClient.deleteTicket(ticket.id)
    await interaction.channel.delete();

}

function getMissingPermissionPayload() {
    const embed = new MessageEmbed()
        .setColor("#FF2445")
        .setTitle("You don't have permission to use this command!")
        .setTimestamp()
    return { embeds: [embed], ephemeral: true };
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