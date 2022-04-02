const { MessageEmbed } = require("discord.js");
const ScrimsMessageBuilder = require("../lib/responses");

async function onSubmit(interaction) {

    if (!interaction.guild) return interaction.reply(ScrimsMessageBuilder.guildOnlyMessage());
    
    interaction.ticketType = interaction.args.shift()
    interaction.firstResponse = interaction.getTextInputValue('request-reason');

    const allowed = await interaction.client.support.verifyTicketRequest(interaction, interaction.ticketType)
    if (!allowed) return false;

    await interaction.deferReply({ ephemeral: true }); // Why is this not async?
    await createTicket(interaction)

}

async function createTicket(interaction) {

    const mentionRoles = await getMentionRoles(interaction.guild)
    const channel = await createTicketChannel(interaction.client, interaction.guild, interaction.channel.parentId, interaction.user, interaction.ticketType)

    const result = await interaction.client.database.tickets.create({ 
        id_user: interaction.scrimsUser.id_user, 
        type: { name: interaction.ticketType },
        guild_id: interaction.guild.id, 
        channel_id: channel.id, 
        created_at: Math.round(Date.now()/1000) 
    }).catch(error => error)

    if (result instanceof Error) {

        await channel.delete().catch(console.error)
        throw result;

    }

    await interaction.followUp(getCreatedPayload(channel))
    await channel.send(getIntroPayload(interaction.member, mentionRoles, interaction.firstResponse, interaction.ticketType))

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

    const positionRoles = await guild.client.database.positionRoles.get({ guild_id: guild.id, position: { name: "ticket_open_mention" } })
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

async function createTicketChannel(client, guild, categoryId, user, type) {

    const title = `${type}-${user.username.toLowerCase()}`;

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