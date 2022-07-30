const { MessageEmbed, GuildMember, MessageActionRow, Guild } = require("discord.js");
const ScrimsTicket = require('../lib/scrims/ticket');
const AsyncFunctionBuffer = require("../lib/tools/buffer");
const SupportResponseMessageBuilder = require('./responses');
const TicketCreateExchange = require("./ticket_create_exchange");

const componentHandlers = {

    "ticketCreate": onTicketCreateRequest,
    "ticketClose": onTicketCloseRequest

}

/**
 * @param { import('../types').ScrimsComponentInteraction | import('../types').ScrimsModalSubmitInteraction } interaction 
 */
async function onComponent(interaction) {

    const handler = componentHandlers[interaction.args.shift()]
    if (handler) {

        if (!interaction.guild) return interaction.reply(SupportResponseMessageBuilder.guildOnlyMessage(interaction.i18n));

        return handler(interaction);

    }

}

/**
 * @param { import('../types').ScrimsComponentInteraction } interaction 
 */
function getTicketTypeFromName(interaction) {

    const ticketTypeName = interaction.args.shift()
    if (!ticketTypeName) return null;

    return interaction.client.database.ticketTypes.cache.find({ name: ticketTypeName });

}

/**
 * @param { import('../types').ScrimsComponentInteraction } interaction 
 */
async function onTicketCreateRequest(interaction) {

    const ticketType = getTicketTypeFromName(interaction)
    if (!ticketType) return interaction.reply(SupportResponseMessageBuilder.failedMessage('This is not a valid ticket type, try again with a support ticket.'));

    const allowed = await interaction.client.support.verifyTicketRequest(interaction.scrimsUser, interaction.guildId, ticketType.name)
    if (allowed !== true) return interaction.reply(allowed);

    const exchange = new TicketCreateExchange(interaction.client, interaction.guild, interaction.scrimsUser, ticketType, interaction.channel.parentId, exchange => createTicketBuffer.run(exchange))
    await exchange.send(interaction)

}

const createTicketBuffer = new AsyncFunctionBuffer(createTicket)

/**
 * @param { TicketCreateExchange } exchange 
 */
async function createTicket(exchange) {

    const allowed = await exchange.client.support.verifyTicketRequest(exchange.creator, exchange.guild.id, exchange.ticketType.name)
    if (allowed !== true) return allowed;

    const category = exchange.client.support.getTicketCategory(exchange.guild.id, exchange.ticketType.name)?.id ?? exchange.categoryId
    const ticketIndex = await exchange.client.database.tickets.callFunction("nextval", ["support_ticket_index"])
    const channel = await createTicketChannel(exchange.client, exchange.guild, category, exchange.creator.discordUser, exchange.ticketType.name, ticketIndex, exchange.isScreenshare())

    const ticket = await exchange.client.database.tickets.create(

        new ScrimsTicket(exchange.client.database)
            .setUser(exchange.creator)
            .setType(exchange.ticketType)
            .setGuild(exchange.guild)
            .setStatus("open")
            .setChannel(channel)

    ).catch(error => error)

    if (ticket instanceof Error) {

        await channel.delete().catch(console.error)
        throw ticket;

    }

    sendTicketChannelMessages(exchange, ticket, channel).catch(console.error)
    return getCreatedPayload(channel, ticket.type);

}

/**
 * @param { TicketCreateExchange } exchange 
 * @param { import("discord.js").TextBasedChannel } channel
 */
async function sendTicketChannelMessages(exchange, ticket, channel) {

    const payload = await exchange.client.support.getTicketInfoPayload(exchange)
    const message = await channel.send(payload).catch(console.error)
    if (message) await message.edit({ ...payload, content: null }).catch(console.error)

    const targets = exchange.getValue("targets")
    const reason = exchange.getValue("reason")

    const logMessage = {

        id: exchange.customId,
        createdTimestamp: Date.now(),
        author: exchange.creator.discordUser,
        content: `Created a ${exchange.ticketType.name} ticket.`
            + ((targets?.length > 0) ? ` Reporting: ${targets.map(target => (target?.user?.tag || target?.tag) ? `@${target?.user?.tag || target.tag}` : target).join(' | ')}` : ``)
            + (reason ? ` Reason: ${reason}` : ``)

    }

    await exchange.client.support.transcriber.transcribe(ticket.id_ticket, logMessage).catch(console.error)

}

function getSupportLevelRoles(client, guild) {

    const support = client.database.positions.cache.find({ name: "support" })
    if (!support) return [];
    return support.getPositionLevelPositions().map(position => client.permissions.getPositionRequiredRoles(guild.id, position)).flat();

}


function getTournamentLevelRoles(client, guild) {

    const to = client.database.positions.cache.find({ name: "tournament_organizer" })
    if (!to) return [];
    return to.getPositionLevelPositions().map(position => client.permissions.getPositionRequiredRoles(guild.id, position)).flat();

}


function getScreensharerLevelRoles(client, guild) {
    const ss = client.database.positions.cache.find({ name: "screensharer" })
    if (!ss) return [];
    return ss.getPositionLevelPositions().map(position => client.permissions.getPositionRequiredRoles(guild.id, position)).flat();
}

function getChannelName(type, user, ticketIndex, ss) {
    if (ss) return `screenshare-${user.username.toLowerCase()}`;
    if (type !== 'report') return `${type}-${user.username.toLowerCase()}`;
    return `${type}-${ticketIndex}`;
}

async function createTicketChannel(client, guild, categoryId, user, type, ticketIndex, ss) {

    const title = getChannelName(type, user, ticketIndex, ss);
    const roles = getSupportLevelRoles(client, guild);

    if (ss) roles.push(...getScreensharerLevelRoles(client, guild));
    else if (type === 'tournament') roles.push(...getTournamentLevelRoles(client, guild));
    
    return guild.channels.create(title, {
        parent: categoryId || null,
        permissionOverwrites: [
            {
                id: guild.roles.everyone,
                deny: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"],
            },
            ...[user.id, ...roles]
                .map(id => ({ id, allow: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY", "SEND_MESSAGES"] }))
        ],
    });

}


function getCreatedPayload(channel, type) {

    const embed = new MessageEmbed()
        .setColor("#83CF5D")
        .setTitle(`Created ${type.capitalizedName} Ticket`)
        .setDescription(`Opened a new ticket for your ${type.name} request at ${channel}.`)

    return { content: null, components: [], embeds: [embed], ephemeral: true };

}

const closeRequestHandlers = { "ACCEPT": onAccept, "DENY": onDeny, "FORCE": onForce }

/**
 * @param { import('../types').ScrimsComponentInteraction } interaction 
 */
async function onTicketCloseRequest(interaction) {

    const ticketId = interaction.args.shift()
    if (ticketId) interaction.ticket = await interaction.client.database.tickets.find(ticketId)

    const executorId = interaction.args.shift()
    if (executorId) interaction.executor = await interaction.client.users.fetch(executorId)

    const fields = interaction.message.embeds[0]?.fields
    if (fields) interaction.reason = fields.find(field => field.name === 'Reason')?.value?.replace(/```/g, '')
    if (!interaction.reason) interaction.reason = 'no reason provided'

    if (!interaction.ticket || !interaction.executor || interaction.ticket.status.name === 'deleted') {

        interaction.client.support.cancelCloseTimeout(interaction.message.id)
        if (interaction.message.deletable) await interaction.message.delete().catch(() => null)
        else await interaction.editReply({ content: 'This message is invalid.', components: [], embeds: [] }).catch(() => null)

        return false;

    }

    const handler = closeRequestHandlers[interaction.args.shift()];
    if (!handler) return interaction.reply({ content: "This button does not have a handler. Please refrain from trying again.", ephemeral: true });

    await interaction.deferReply({ ephemeral: true })
    return handler(interaction, interaction.ticket);

}

/**
 * @param { import('../types').ScrimsComponentInteraction } interaction 
 * @param { ScrimsTicket } ticket
 */
async function onDeny(interaction, ticket) {

    const ticketCreatorId = ticket.user.discord_id;
    if (ticketCreatorId !== interaction.user.id)
        return interaction.editReply(getNotAllowedPayload(interaction.i18n, ticket.user));

    interaction.client.support.cancelCloseTimeout(interaction.message.id)
    const transcriber = interaction.client.support.transcriber;
    const message = {
        id: interaction.id, author: interaction.user,
        content: `denied the close request from ${interaction.executor.tag} with reason: ${interaction.reason}`
    }
    // Command should not abort just because the event was not logged
    await transcriber.transcribe(ticket.id_ticket, message).catch(console.error);

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
        return interaction.editReply(getNotAllowedPayload(interaction.i18n, ticket.user));

    await interaction.client.support.closeTicket(
        interaction.ticket, interaction.executor,
        interaction.user, `accepted the close request from ${interaction.executor.tag} with reason: ${interaction.reason}`
    )

}

/**
 * @param { import('../types').ScrimsComponentInteraction } interaction 
 * @param { ScrimsTicket } ticket
 */
async function onForce(interaction, ticket) {

    const hasPermission = interaction.scrimsPositions.hasPositionLevel('support')
    if (!hasPermission) return interaction.editReply(SupportResponseMessageBuilder.missingPermissionsMessage(interaction.i18n, 'You must be bridge scrims support or higher to do this.'))

    await interaction.client.support.closeTicket(
        ticket, interaction.executor, interaction.user,
        `forcibly closed this ticket using the request from ${interaction.executor.tag} with reason: ${interaction.reason}`
    )

}

function getNotAllowedPayload(i18n, ticketCreator) {

    return SupportResponseMessageBuilder.missingPermissionsMessage(
        i18n, `Only ${ticketCreator?.getMention('**') ?? '@unknown-user'} can make this decision.`
    );

}

module.exports = onComponent;