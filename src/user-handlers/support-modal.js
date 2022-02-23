const { ModalSubmitInteraction } = require("discord-modals");
const { MessageEmbed } = require("discord.js");

async function onSubmit(interaction) {

    if (!(interaction instanceof ModalSubmitInteraction)) // "Houston, we have a problem"
        return interaction.reply({ content: "How did we get here?" });

    interaction.ticketId = interaction.args.shift()
    interaction.firstResponse = interaction.getTextInputValue('request-reason');
    await interaction.deferReply({ ephemeral: true }); // Why is this not async?

    const dbClient = interaction.client.database; // Instance of DBClient created in bot.js
    const ticket = await dbClient.getTicket({ userId: interaction.userId })

    if (ticket === null) return createTicket(interaction); // New ticket to be created

    const channel = await fetchChannel(interaction.guild, ticket.channelId)
    if (channel) return interaction.editReply(getAlreadyCreatedPayload(channel)); // Someone is trying to create a second ticket smh
    
    await dbClient.deleteTicket(ticket.id)
    await createTicket(interaction); // Ticket was created, but since channel was deleted create it again :D

}

async function fetchChannel(guild, id) {
    if (!id) return null;
    return guild.channels.fetch(id); // If id is falsley channel.fetch would fetch all
}

async function createTicket(interaction) {
    const dbClient = interaction.client.database; // Instance of DBClient created in bot.js
    const channel = await createTicketChannel(interaction.guild, interaction.user)

    await dbClient.createTicket(interaction.ticketId, channel.id, interaction.userId)
    await interaction.followUp({ embeds: [getCreatedPayload(channel)] })
    await channel.send({ embeds: [getIntroPayload(interaction.firstResponse)] })
}

function getAlreadyCreatedPayload(channel) {
    const embed = MessageEmbed()
        .setColor("#2F3136")
        .setTitle(`Error`)
        .setDescription(`You already have a ticket open (${channel}).`)
        .setTimestamp();

    return { embeds: [embed] };
}

function getCreatedPayload(channel) {
    const embed = new MessageEmbed()
        .setColor("#83cf5d")
        .setTitle(`Created Ticket`)
        .setDescription(`Opened a new ticket: ${channel}`)
        .setTimestamp()

    return { embeds: [embed] };
}

function getIntroPayload(firstResponse) {
    const embed = new MessageEmbed()
        .setColor("#5d9acf")
        .setTitle(`Support`)
        .setDescription(
            "Thank you for opening a support ticket on Ranked Bridge! "
            + "If there is any way that we can assist you, please state it below and we will be glad to help! "
            + "Regarding Staff/Scorer applications, Staff will send you a Google Document for you to fill out. "
            + "We are working on automating the process for applications, so please be patient as we work on developing that!"
            + `\n\`Reason:\`\n\`\`\`${firstResponse}\`\`\``
        ).setTimestamp()

    return { embeds: [embed] };
}

async function createTicketChannel(client, guild, user) {
    const title = $`support-${user.username.toLowerCase()}`;

    return guild.channels.create(title, {
        permissionOverwrites: [
            {
                id: guild.roles.everyone,
                deny: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"],
            },
            ...[ user.id, ...client.supportRoles ] // Support roles and the creator of the support ticket
                .map(id => ({ id, allow: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY", "SEND_MESSAGES"] }))
        ],
    });
}

module.exports = onSubmit;