const { MessageEmbed } = require("discord.js");
const ScrimsMessageBuilder = require("../lib/responses");

async function onSubmit(interaction) {

    if (!interaction.guild) return interaction.reply(ScrimsMessageBuilder.guildOnlyMessage());
    
    interaction.firstResponse = interaction.getTextInputValue('request-reason');
    await interaction.deferReply({ ephemeral: true }); // Why is this not async?

    const ticketClient = interaction.client.database.tickets
    const ticket = ticketClient.cache.get({ user: { discord_id: interaction.userId } })[0]

    if (!ticket) return createTicket(interaction); // New ticket to be created

    const channel = await fetchChannel(interaction.guild, ticket.channel_id).catch(() => null)

    // Someone is trying to create a second ticket smh
    if (channel) return interaction.editReply(ScrimsMessageBuilder.errorMessage("Already Created", `You already have a ticket open (${channel}).`)); 
    
    await interaction.client.database.transcript.remove({ id_ticket: ticket.id_ticket })
    await ticketClient.remove({ id_ticket: ticket.id_ticket })

    await createTicket(interaction); // Ticket was created, but since channel was deleted create it again :D

}

async function fetchChannel(guild, id) {
    if (!id) return null;
    return guild.channels.fetch(id); // If id is falsley channel.fetch would fetch all channels
}

async function createTicket(interaction) {
    
    if (!interaction.scrimsUser) return interaction.editReply(ScrimsMessageBuilder.scrimsUserNeededMessage())
    
    const ticketClient = interaction.client.database.tickets; 
    const channel = await createTicketChannel(interaction.client, interaction.guild, interaction.user)

    await ticketClient.create({ 
        id_user: interaction.scrimsUser.id_user, 
        guild_id: interaction.guild.id, 
        channel_id: channel.id, 
        created_at: Math.round(Date.now()/1000) 
    })
    await interaction.followUp(getCreatedPayload(channel))
    await channel.send(getIntroPayload(interaction.member, interaction.firstResponse))
}

function getCreatedPayload(channel) {
    const embed = new MessageEmbed()
        .setColor("#83CF5D")
        .setTitle(`Created Ticket`)
        .setDescription(`Opened a new ticket: ${channel}`)
        .setTimestamp()

    return { embeds: [embed] };
}

function getIntroPayload(member, firstResponse) {
    const embed = new MessageEmbed()
        .setColor("#5D9ACF")
        .setTitle(`Support`)
        .addField("Reason", `\`\`\`${firstResponse}\`\`\``)
        .setDescription(
            `Hello ${member.displayName}, thank you for reaching out to the bridge scrims support team! `
            + `Please describe your issue, and support will be with you any moment.`
        ).setTimestamp()

    return { content: `${member}`, embeds: [embed] };
}

function getSupportLevelRoles(client, guild) {

    return client.permissions.getPermissionLevelPositions("support").map(position => client.permissions.getPositionRequiredRoles(guild.id, position)).flat();

}

async function createTicketChannel(client, guild, user) {
    const title = `support-${user.username.toLowerCase()}`;

    return guild.channels.create(title, {
        permissionOverwrites: [
            {
                id: guild.roles.everyone,
                deny: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"],
            },
            ...[ user.id, ...getSupportLevelRoles(client, guild) ] 
                .map(id => ({ id, allow: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY", "SEND_MESSAGES"] }))
        ],
    });
}

module.exports = onSubmit;