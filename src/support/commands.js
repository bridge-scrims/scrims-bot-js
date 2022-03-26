const { MessageEmbed, MessageActionRow, MessageButton, CommandInteraction } = require("discord.js");

const commandHandlers = { "close": requestTicketClosure, "forceclose": forceCloseTicket }
async function onCommand(interaction) {

    const handler = commandHandlers[interaction.commandName]
    if (handler) return handler(interaction).catch(console.error);
    
}


async function requestTicketClosure(interaction) {
    const reason = interaction.options.getString('reason') ?? "No reason provided.";
    
    const ticketClient = interaction.client.database.tickets; // Instance of DBClient created in bot.js
    const ticket = await ticketClient.get({ channelId: interaction.channel.id })

    if (ticket === null) return interaction.reply(getMissingTicketPayload()); // This is no ticket channel (bruh moment)
    
    await interaction.reply(getCloseRequestPayload(interaction.user, reason, ticket)) // Close request sent and is awaiting aproval!
}

function getCloseRequestActions(ticketId) {
    return new MessageActionRow()
        .addComponents([
            new MessageButton()
                .setCustomId(`TicketCloseRequest/ACCEPT/${ticketId}`)
                .setLabel("✅ Accept & Close")
                .setStyle("PRIMARY"),
            new MessageButton()
                .setCustomId(`TicketCloseRequest/DENY/${ticketId}`)
                .setLabel("❌ Deny & Keep Open")
                .setStyle("PRIMARY")
        ])
}

function getCloseRequestPayload(user, reason, ticket) {
    const embed = new MessageEmbed()
        .setColor("#5D9ACF")
        .setTitle("Close Request")
        .addField("Reason", `\`\`\`${reason}\`\`\``, false)
        .setDescription(
            `${user} has requested to close this ticket. `
            + `Please accept or deny using the buttons below.`
        ).setTimestamp()

    return { content: `<@${ticket.userId}>`, embeds: [embed], components: [ getCloseRequestActions(ticket.id) ] };
}


async function forceCloseTicket(interaction) {

    const ticketTable = interaction.client.database.tickets; 
    const ticket = await ticketTable.get({ channelId: interaction.channel.id })
    if (ticket === null) return interaction.reply(getMissingTicketPayload()); // This is not a ticket channel (bruh moment)
    
    const transcriber = interaction.client.transcriber; // Instance of TicketTranscriber created in bot.js
    await transcriber.transcribe(
        ticket.id, { ...interaction, createdTimestamp: interaction.createdTimestamp, content: "forcibly closed this request" }
    ).catch(console.error); // Command should not abort just because the event was not logged
    await transcriber.send(interaction.guild, ticket).catch(console.error); // Command should not abort just because their was an error with the log

    await ticketTable.remove(ticket.id)
    await interaction.channel.delete();

}



function getMissingTicketPayload() {

    const embed = new MessageEmbed()
        .setColor("#FF2445")
        .setTitle("Error")
        .setDescription("This isn't a ticket channel!")
        .setTimestamp()

    return { embeds: [embed], ephemeral: true };

}


module.exports = onCommand;