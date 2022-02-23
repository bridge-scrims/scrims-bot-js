const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");

async function onCommand(interaction) {

    if (!interaction?.isCommand()) // "Houston, we have a problem"
        return interaction.reply({ content: "How did we get here?", ephemeral: true });

    if (!interaction.fromSupport) return interaction.reply(getMissingPermissionPayload()); // Get outa here   
    
    const commandHandler = getHandler(interaction?.options?.getSubcommand())
    if (!commandHandler) return interaction.reply({ content: "This Subcommand does not have a handler. Please refrain from trying again.", ephemeral: true });

    return commandHandler(interaction);

}

function getHandler(subCommand) {
    switch (subCommand) {
        case ("reason"):
            return reason;
        default:
            return false;
    }
}

async function reason(interaction) {

    const reason = interaction.options.getString('reason') ?? "No reason provided.";
    
    const dbClient = interaction.client.database; // Instance of DBClient created in bot.js
    const ticket = await dbClient.getTicket({ channelId: interaction.channel.id })

    if (ticket === null) return interaction.reply(getMissingTicketPayload()); // This is no ticket channel (bruh moment)
    
    await interaction.channel.send(getCloseRequestPayload(interaction.user, reason, ticket)); // Close request sent and is awaiting aproval!

}

function getCloseActions(ticketId) {
    return new MessageActionRow()
        .addComponents(
            new MessageButton()
            .setCustomId(`TicketCloseRequest/DENY/${ticketId}`)
            .setLabel("❌ Deny & Keep Open")
            .setStyle("PRIMARY")
        );
}

function getOpenActions(ticketId) {
    return new MessageActionRow()
        .addComponents(
            new MessageButton()
            .setCustomId(`TicketCloseRequest/ACCEPT/${ticketId}`)
            .setLabel("✅ Accept & Close")
            .setStyle("PRIMARY")
        );
}

function getCloseRequestPayload(user, reason, ticket) {
    const embed = new MessageEmbed()
        .setColor("#5d9acf")
        .setTitle("Close Request")
        .setDescription(
            `${user} has requested to close this ticket. Reason:\n\`\`\`${reason}\`\`\`\n`
                + `Please accept or deny using the buttons below.`
        ).setTimestamp();
    return { content: `<@${ticket.userId}>`, embeds: [embed], components: [ getOpenActions(ticket.id), getCloseActions(ticket.id) ] };
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