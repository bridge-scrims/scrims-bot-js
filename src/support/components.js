const { MessageEmbed, GuildMember, MessageActionRow, Guild } = require("discord.js");
const MemoryMessageButton = require('../lib/memory_button');
const ScrimsTicket = require('../lib/scrims/ticket');
const SupportResponseMessageBuilder = require('./responses');

const componentHandlers = {

    "ticketModalSubmit": onTicketModalSubmit,
    "ticketCreate": onTicketCreateRequest,
    "ticketClose": onTicketCloseRequest, 
    "sendTicket": onTicketSendRequest 

}

/**
 * @param { import('../types').ScrimsComponentInteraction | import('../types').ScrimsModalSubmitInteraction } interaction 
 */
async function onComponent(interaction) {

    const handler = componentHandlers[interaction.args.shift()]
    if (handler) {

        if (!interaction.guild) return interaction.reply(SupportResponseMessageBuilder.guildOnlyMessage());

        return handler(interaction);

    }

}

/**
 * @param { import('../types').ScrimsModalSubmitInteraction } interaction 
 */
function getTicketTypeFromId(interaction) {

    const id_type = interaction.args.shift()
    if (!id_type) return null;

    return interaction.client.database.ticketTypes.cache.get(id_type);

}

/**
 * @param { import('../types').ScrimsModalSubmitInteraction } interaction 
 */
async function onTicketModalSubmit(interaction) {

    const ticketData = {}

    ticketData.type = getTicketTypeFromId(interaction)
    if (!ticketData.type) return interaction.reply(SupportResponseMessageBuilder.failedMessage('create a support ticket'));

    const inputValue = interaction.getTextInputValue('request-reason')
    if (typeof inputValue !== 'string') return interaction.reply(SupportResponseMessageBuilder.errorMessage('Invalid Reason', "You reason must contain at least 15 letters to be valid."));
    
    ticketData.reason = SupportResponseMessageBuilder.stripText(inputValue)

    ticketData.targets = await SupportResponseMessageBuilder.parseDiscordUsers(interaction.guild, interaction.getTextInputValue('targets'))

    const actions = new MessageActionRow()
        .addComponents(
            new MemoryMessageButton(interaction.client, ticketData).setCustomId('support/sendTicket/CREATE').setLabel('Create').setStyle('SUCCESS'),
            new MemoryMessageButton(interaction.client, ticketData).setCustomId('support/sendTicket/REOPEN').setLabel('Edit').setStyle('PRIMARY'),
            SupportResponseMessageBuilder.cancelButton()
        )

    const payload = { 
        ...(await interaction.client.support.getTicketInfoPayload(interaction.member, [], { ...ticketData })), content: `**This is just a preview of what the support team will see.**`, 
        components: [ actions ], ephemeral: true 
    }

    if (interaction.args.shift() === 'REOPEN') {
        
        MemoryMessageButton.destroyMessage(interaction.message)
        await interaction.update(payload)

    }else {

        await interaction.deferReply({ ephemeral: true })
        await interaction.editReply(payload)

    }

}

/**
 * @param { import('../types').ScrimsComponentInteraction } interaction 
 */
function getTicketTypeFromName(interaction) {

    const ticketTypeName = interaction.args.shift()
    if (!ticketTypeName) return null;

    return interaction.client.database.ticketTypes.cache.find({ name: ticketTypeName })[0] ?? null;

}

/**
 * @param { import('../types').ScrimsComponentInteraction } interaction 
 */
async function onTicketCreateRequest(interaction) {

    const ticketType = getTicketTypeFromName(interaction)
    if (!ticketType) return interaction.reply(SupportResponseMessageBuilder.failedMessage('create a support ticket'));

    const allowed = await interaction.client.support.verifyTicketRequest(interaction, ticketType.name)
    if (allowed !== true) return interaction.reply(allowed);

    await interaction.sendModal(SupportResponseMessageBuilder.ticketCreateModal(ticketType, false))

}

const ticketSendRequestHandlers = { "CREATE": createTicket, "REOPEN": reopenModal }

/**
 * @param { import('../types').ScrimsComponentInteraction } interaction 
 */
async function onTicketSendRequest(interaction) {

    const handler = ticketSendRequestHandlers[interaction.args.shift()];
    if (!handler) return interaction.reply({ content: "This button does not have a handler. Please refrain from trying again.", ephemeral: true });

    if (!interaction.memoryData) return interaction.update({ content: `This message can not be served.`, embeds: [], components: [] });
    interaction.ticketData = interaction.memoryData

    const allowed = await interaction.client.support.verifyTicketRequest(interaction, interaction.ticketData.type.name)
    if (allowed !== true) return interaction.update(allowed);

    return handler(interaction);

}

/**
 * @param { import('../types').ScrimsComponentInteraction } interaction 
 */
async function reopenModal(interaction) {

    const fields = []
    if (interaction.ticketData?.reason) fields.push({ customId: 'request-reason', value: interaction.ticketData.reason })
    if (interaction.ticketData?.targets) 
        fields.push({ customId: 'targets', value: interaction.ticketData.targets.map(value => (value instanceof GuildMember) ? value.user.tag : value.slice(2, -2)).join(' ').split('').slice(0, 100).join('') })

    return interaction.sendModal(SupportResponseMessageBuilder.ticketCreateModal(interaction.ticketData.type, true), fields);

} 

function generateRandomLetter() {

    const alphabet = "abcdefghijklmnopqrstuvwxyz"
    return alphabet[Math.floor(Math.random() * alphabet.length)];

}

/**
 * @param { import('../types').ScrimsComponentInteraction } interaction 
 */
async function createTicket(interaction) {

    if (!interaction.scrimsUser) return interaction.reply(SupportResponseMessageBuilder.scrimsUserNeededMessage());

    await interaction.update({ content: `Ticket is being created...`, components: [], embeds: [] });

    const mentionRoles = await getMentionRoles(interaction.guild)

    const category = interaction.client.support.getTicketCategory(interaction.guild.id, interaction.ticketData.type)
    
    const channelParentId = category?.id ?? interaction?.channel?.parentId;
    const channel = await createTicketChannel(interaction.client, interaction.guild, channelParentId, interaction.user, interaction.ticketData.type.name)

    const allowed = await interaction.client.support.verifyTicketRequest(interaction, interaction.ticketData.type.name)
    if (allowed !== true) {
        
        await channel.delete().catch(console.error)
        return interaction.editReply(allowed);

    }

    const ticket = await interaction.client.database.tickets.create({ 

        id_ticket: interaction.client.database.generateUUID(),
        id_user: interaction.scrimsUser.id_user, 
        id_type: interaction.ticketData.type.id_type,
        guild_id: interaction.guild.id,
        status: { name: "open" },
        channel_id: channel.id, 
        created_at: Math.round(Date.now()/1000) 

    }).catch(error => error)

    if (ticket instanceof Error) {

        await channel.delete().catch(console.error)
        throw ticket;

    }

    const ticketIndex = await interaction.client.database.query(`SELECT nextval('support_ticket_index');`)
        .then(result => result.rows[0]?.nextval ?? `${generateRandomLetter()}${generateRandomLetter()}`.toUpperCase())

    await interaction.followUp(getCreatedPayload(channel, ticket.type))

    const message = await channel.send(await interaction.client.support.getTicketInfoPayload(interaction.member, mentionRoles, interaction.ticketData)).catch(console.error)
    if (message) await message.edit(await interaction.client.support.getTicketInfoPayload(interaction.member, [], interaction.ticketData)).catch(console.error)

    const logMessage = { 

        id: interaction.id, 
        createdTimestamp: Date.now(),
        author: interaction.user, 
        content: `Created a ${interaction.ticketData.type.name} ticket. Reason: ${interaction.ticketData.reason}` 

    }
    await interaction.client.support.transcriber.transcribe(ticket.id_ticket, logMessage).catch(console.error)
    
    if (interaction.ticketData.type.name === 'report')
        await channel.setName(`${channel.name}-${ticketIndex}`).catch(console.error)

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

async function getMentionRoles(guild) {

    const positionRoles = await guild.client.database.positionRoles.get({ guild_id: guild.id, position: { name: "ticket_open_mention" } })
    return positionRoles.map(posRole => guild.roles.resolve(posRole.role_id)).filter(role => role);

}

function getCreatedPayload(channel, type) {

    const embed = new MessageEmbed()
        .setColor("#83CF5D")
        .setTitle(`Created ${type.capitalizedName} Ticket`)
        .setDescription(`Opened a new ticket for your ${type.name} request at ${channel}.`)

    return { embeds: [embed], ephemeral: true };
    
}

const closeRequestHandlers = { "ACCEPT": onAccept, "DENY": onDeny, "FORCE": onForce }

/**
 * @param { import('../types').ScrimsComponentInteraction } interaction 
 */
async function onTicketCloseRequest(interaction) {

    const ticketId = interaction.args.shift()
    if (ticketId) interaction.ticket = await interaction.client.database.tickets.get({ id_ticket: ticketId }).then(v => v[0])

    if (!ticketId || !interaction.ticket) {

        if (interaction.message.deletable) await interaction.message.delete().catch(() => null)
        else await interaction.editReply({ content: 'This message is invalid.', components: [], embeds: [] }).catch(() => null)

        return false;

    }

    const handler = closeRequestHandlers[interaction.args.shift()];
    if (!handler) return interaction.reply({ content: "This button does not have a handler. Please refrain from trying again.", ephemeral: true });
    
    await interaction.deferReply({ ephemeral: true }); // Inform the user that the bot needs to do some thinking
    return handler(interaction, interaction.ticket);

}

/**
 * @param { import('../types').ScrimsComponentInteraction } interaction 
 * @param { ScrimsTicket } ticket
 */
async function onDeny(interaction, ticket) {

    const ticketCreatorId = ticket.user.discord_id;
    if (ticketCreatorId !== interaction.user.id)
        return interaction.editReply(getNotAllowedPayload(ticket.user));

    const transcriber = interaction.client.support.transcriber;
    const message = { ...interaction, createdTimestamp: interaction.createdTimestamp, author: interaction.user, content: "denied the close request" }
    await transcriber.transcribe(ticket.id_ticket, message).catch(console.error); // Command should not abort just because the event was not logged

    await interaction.editReply("Close request denied.");
    await interaction.message.edit(SupportResponseMessageBuilder.errorMessage(`Close Request Denied`, `${interaction.user} has denied the close request.`));

}

/**
 * @param { import('../types').ScrimsComponentInteraction } interaction 
 * @param { ScrimsTicket } ticket
 */
async function onAccept(interaction, ticket) {

    const ticketCreatorId = ticket.user.discord_id;
    if (ticketCreatorId !== interaction.user.id)
        return interaction.editReply(getNotAllowedPayload(ticket.user));

    const transcriber = interaction.client.support.transcriber;
    const message = { ...interaction, createdTimestamp: interaction.createdTimestamp, author: interaction.user, content: "accepted the close request" }
    await transcriber.transcribe(ticket.id_ticket, message).catch(console.error); // Command should not abort just because the event was not logged
    
    await interaction.client.support.closeTicket(interaction.channel, interaction.ticket, interaction.user)

}

/**
 * @param { import('../types').ScrimsComponentInteraction } interaction 
 * @param { ScrimsTicket } ticket
 */
 async function onForce(interaction, ticket) {

    const hasPermission = await interaction.member.hasPermission('support')
    if (!hasPermission) return interaction.editReply(SupportResponseMessageBuilder.missingPermissionsMessage('You must be bridge scrims support or higher to do this.'))

    const transcriber = interaction.client.support.transcriber;
    const message = { ...interaction, createdTimestamp: interaction.createdTimestamp, author: interaction.user, content: "forcibly closed this request" }
    await transcriber.transcribe(ticket.id_ticket, message).catch(console.error); // Command should not abort just because the event was not logged
    
    await interaction.client.support.closeTicket(interaction.channel, interaction.ticket, interaction.user)

}

function getNotAllowedPayload(ticketCreator) {

    return SupportResponseMessageBuilder.missingPermissionsMessage(
        `Only ${ticketCreator?.getMention('**') ?? 'unknown-user'} can close this ticket.`
    );

}

module.exports = onComponent;