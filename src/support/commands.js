const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const ScrimsMessageBuilder = require("../lib/responses");

const commandHandlers = { "close": requestTicketClosure, "forceclose": forceCloseTicket, "support-message": supportMessage }
async function onCommand(interaction) {

    const handler = commandHandlers[interaction.commandName]
    if (handler) {

        if (!interaction.guild) return interaction.reply(ScrimsMessageBuilder.guildOnlyMessage());

        return handler(interaction);

    }
    
}


async function supportMessage(interaction) {

    const action = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId("support")
                .setLabel("✉️ Support")
                .setStyle("PRIMARY")
        );

    const embed = new MessageEmbed()
        .setColor("#5D9ACF")
        .setTitle("Bridge Scrims Support")
        .setDescription("If you do not state your issue within 5 minutes of creating your ticket, it will be closed.")
        .setTimestamp();

    await interaction.channel.send({ embeds: [embed], components: [action] })
    await interaction.reply({ content: "Message created.", ephemeral: true })

}


async function requestTicketClosure(interaction) {

    const reason = interaction.options.getString('reason') ?? "No reason provided.";

    const ticket = interaction.client.database.tickets.cache.get({ channel_id: interaction.channel.id })[0]

    if (!ticket) return interaction.reply(getMissingTicketPayload()); // This is no support channel (bruh moment)
    
    if (ticket.id_user == interaction.scrimsUser.id_user) {
        
        // Creator wants to close the ticket so close it
        return closeTicket(interaction, ticket, `closed this request because of ${reason}`)

    }

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

    return { content: `<@${ticket.user.discord_id}>`, embeds: [embed], components: [ getCloseRequestActions(ticket.id_ticket) ] };
    
}

async function closeTicket(interaction, ticket, content) {

    const transcriber = interaction.client.support.transcriber;
    const message = { ...interaction, createdTimestamp: interaction.createdTimestamp, author: interaction.user, content }
    await transcriber.transcribe(ticket.id_ticket, message).catch(console.error); // Command should not abort just because the event was not logged
    await transcriber.send(interaction.guild, ticket).catch(console.error); // Command should not abort just because their was an error with the transcriber

    await interaction.client.database.tickets.remove({ id_ticket: ticket.id_ticket })
    await interaction.channel.delete();

}


async function forceCloseTicket(interaction) {

    const ticketTable = interaction.client.database.tickets; 
    const ticket = ticketTable.cache.get({ channel_id: interaction.channel.id })[0]
    if (!ticket) return interaction.reply(getMissingTicketPayload()); // This is no support channel (bruh moment)
    
    await closeTicket(interaction, ticket, "forcibly closed this request")

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