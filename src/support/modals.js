const { MessageEmbed } = require("discord.js");
const ScrimsMessageBuilder = require("../lib/responses");

function getReasonText(text) {

    while (text.includes("\n\n\n")) 
        text = text.replace("\n\n\n", "\n\n");

    const lines = text.split("\n")
    if (lines.length > 10)
        text = lines.slice(0, lines.length-(lines.length-10)).join("\n") + lines.slice(lines.length-(lines.length-10)).join(" ")

    return text;
    
}

async function onSubmit(interaction) {

    if (!interaction.guild) return interaction.reply(ScrimsMessageBuilder.guildOnlyMessage());
    
    interaction.ticketType = interaction.args.shift()

    const inputValue = interaction.getTextInputValue('request-reason')
    if (typeof inputValue !== 'string') return interaction.editReply(ScrimsMessageBuilder.errorMessage('Invalid Reason', "You reason must contain at least 15 letters to be valid."));
    
    interaction.firstResponse = getReasonText(inputValue)

    const allowed = await interaction.client.support.verifyTicketRequest(interaction, interaction.ticketType)
    if (!allowed) return false;

    await interaction.deferReply({ ephemeral: true }); // Why is this not async?
    await createTicket(interaction)

}

async function createTicket(interaction) {

    const mentionRoles = await getMentionRoles(interaction.guild)

    const category = interaction.client.support.getTicketCategory(interaction.guild.id, interaction.ticketType)
    
    const channelParentId = category?.id ?? interaction?.channel?.parentId;
    const channel = await createTicketChannel(interaction.client, interaction.guild, channelParentId, interaction.user, interaction.ticketType)

    const result = await interaction.client.database.tickets.create({ 

        id_user: interaction.scrimsUser.id_user, 
        type: { name: interaction.ticketType },
        guild: { discord_id: interaction.guild.id },
        status: { name: "open" },
        channel_id: channel.id, 
        created_at: Math.round(Date.now()/1000) 

    }).catch(error => error)

    if (result instanceof Error) {

        await channel.delete().catch(console.error)
        throw result;

    }

    await interaction.followUp(getCreatedPayload(channel))
    await channel.send(getIntroPayload(interaction.member, mentionRoles, interaction.firstResponse, interaction.ticketType))
   
    const logMessage = { 

        id: interaction.id, 
        createdTimestamp: Date.now(),
        author: interaction.user, 
        content: `Created a ${interaction.ticketType} ticket. Reason: ${interaction.firstResponse}` 

    }
    await interaction.client.support.transcriber.transcribe(result.id_ticket, logMessage).catch(console.error)
    
    if (interaction.ticketType !== 'support')
        await channel.setName(`${channel.name}-${result.id_ticket}`).catch(console.error)

}

function getCreatedPayload(channel) {

    const embed = new MessageEmbed()
        .setColor("#83CF5D")
        .setTitle(`Created Ticket`)
        .setDescription(`Opened a new ticket: ${channel}`)
        .setTimestamp()

    return { embeds: [embed] };
    
}

async function getMentionRoles(guild) {

    const positionRoles = await guild.client.database.positionRoles.get({ guild: { discord_id: guild.id }, position: { name: "ticket_open_mention" } })
    return positionRoles.map(posRole => guild.roles.resolve(posRole.role_id)).filter(role => role);

}

function getIntroPayload(member, mentionRoles, firstResponse, type) {

    const embed = new MessageEmbed()
        .setColor("#5D9ACF")
        .setTitle(`${type.charAt(0).toUpperCase() + type.slice(1)}`)
        .addField("Reason", `\`\`\`${firstResponse}\`\`\``)
        .setDescription(
            `Hello ${member.displayName}, thank you for reaching out to the bridge scrims support team! `
            + `Please describe your issue, and support will be with you any moment.`
        ).setTimestamp()

    return { content: [ member, ...mentionRoles ].join(" "), embeds: [embed] };

}

function getSupportLevelRoles(client, guild) {

    return client.permissions.getPermissionLevelPositions("support").map(position => client.permissions.getPositionRequiredRoles(guild.id, position)).flat();

}

function getChannelName(type, user) {

    if (type === 'support') return `${type}-${user.username.toLowerCase()}`;
    return `${type}`;

}

async function createTicketChannel(client, guild, categoryId, user, type) {

    const title = getChannelName(type, user);

    return guild.channels.create(title, {
        parent: categoryId || null,
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