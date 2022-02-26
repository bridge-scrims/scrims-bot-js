const { MessageEmbed, CommandInteraction } = require("discord.js");

async function onCommand(interaction) {

    if (!(interaction instanceof CommandInteraction)) // "Houston, we have a problem"
        return interaction.reply({ content: "How did we get here?", ephemeral: true });

    const dbClient = interaction.client.database; // Instance of DBClient created in bot.js
    const ticket = await dbClient.getTicket({ channelId: interaction.channel.id })
    if (ticket === null) return interaction.reply(getMissingTicketPayload()); // This is not a ticket channel (bruh moment)
    
    await dbClient.deleteTicket(ticket.id)
    await interaction.channel.delete();

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