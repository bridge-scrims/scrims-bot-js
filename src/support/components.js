const { Modal, TextInputComponent, showModal } = require('discord-modals');
const { MessageEmbed } = require("discord.js");
const ScrimsMessageBuilder = require('../lib/responses');


const componentHandlers = { "support": onSupportComponent, "report": onReportComponent, "TicketCloseRequest": onCloseRequest }
async function onComponent(interaction) {

    const handler = componentHandlers[interaction.commandName]
    if (handler) {

        if (!interaction.guild) return interaction.reply(ScrimsMessageBuilder.guildOnlyMessage());

        return handler(interaction);

    }

}

async function onSupportComponent(interaction) {

    const allowed = await interaction.client.support.verifyTicketRequest(interaction, "support")
    if (!allowed) return false;

<<<<<<< HEAD
    return interaction.client.database.ticketTypes.cache.get(id_type);
=======
    await createModal(interaction, "support")
>>>>>>> main

}

async function onReportComponent(interaction) {

    const allowed = await interaction.client.support.verifyTicketRequest(interaction, "report")
    if (!allowed) return false;

    await createModal(interaction, "report")

}

async function createModal(interaction, typeName) {

    const modal = new Modal()
        .setCustomId(`support-modal/${typeName}`)
        .setTitle(`${typeName.charAt(0).toUpperCase() + typeName.slice(1)} Ticket`)
        .addComponents(
            new TextInputComponent()
                .setCustomId('request-reason')
                .setLabel('Reason for opening a ticket')
                .setStyle('LONG')
                .setMinLength(5)
                .setMaxLength(1000)
                .setPlaceholder('Write here')
                .setRequired(true)
        )

<<<<<<< HEAD
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
=======
    return showModal(modal, { client: interaction.client, interaction });
>>>>>>> main

}



const closeRequestHandlers = { "ACCEPT": onAccept, "DENY": onDeny }
async function onCloseRequest(interaction) {

    const handler = closeRequestHandlers[interaction.args.shift()];
    if (!handler) return interaction.reply({ content: "This button does not have a handler. Please refrain from trying again.", ephemeral: true });

    interaction.ticket = interaction.client.database.tickets.cache.get({ id_ticket: interaction.args.shift() })[0]
    
<<<<<<< HEAD
    const ticketIndex = await interaction.client.database.query(`SELECT nextval('support_ticket_index');`)
        .then(result => result.rows[0]?.nextval ?? `${generateRandomLetter()}${generateRandomLetter()}`.toUpperCase())

    const channelParentId = category?.id ?? interaction?.channel?.parentId;
    const channel = await createTicketChannel(interaction.client, interaction.guild, channelParentId, interaction.user, interaction.ticketData.type.name, ticketIndex)

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

    await interaction.followUp(getCreatedPayload(channel, ticket.type))

    const message = await channel.send(await interaction.client.support.getTicketInfoPayload(interaction.member, mentionRoles, interaction.ticketData)).catch(console.error)
    if (message) await message.edit(await interaction.client.support.getTicketInfoPayload(interaction.member, [], interaction.ticketData)).catch(console.error)

    const logMessage = { 

        id: interaction.id, 
        createdTimestamp: Date.now(),
        author: interaction.user, 
        content: `Created a ${interaction.ticketData.type.name} ticket.${(interaction?.ticketData?.targets?.length > 0) ? ` Reporting: ${interaction.ticketData.targets.map(target => target?.user?.tag ? `@${target.user.tag}` : target).join(' | ')}`: ``} Reason: ${interaction.ticketData.reason}` 

    }
    
    await interaction.client.support.transcriber.transcribe(ticket.id_ticket, logMessage).catch(console.error)
    
}

function getSupportLevelRoles(client, guild) {

    return client.permissions.getPermissionLevelPositions("support").map(position => client.permissions.getPositionRequiredRoles(guild.id, position)).flat();

}

function getChannelName(type, user, ticketIndex) {

    if (type === 'support') return `${type}-${user.username.toLowerCase()}`;
    return `${type}-${ticketIndex}`;

}

async function createTicketChannel(client, guild, categoryId, user, type, ticketIndex) {

    const title = getChannelName(type, user, ticketIndex);

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
    
=======
    // The ticket no longer exists :/
    if (!interaction.ticket) return interaction.message.delete().catch(() => { /* Message could already be deleted */ }) 

>>>>>>> main
    await interaction.deferReply({ ephemeral: true }); // Inform the user that the bot needs to do some thinking
    return handler(interaction);

}

async function onDeny(interaction) {

    const ticketCreatorId = interaction.ticket.user.discord_id;
    if (ticketCreatorId != interaction.userId)
        return interaction.editReply(getNotAllowedPayload(ticketCreatorId, await interaction.member.hasPermission("staff")));

    const transcriber = interaction.client.support.transcriber;
    const message = { ...interaction, createdTimestamp: interaction.createdTimestamp, author: interaction.user, content: "denied the close request" }
    await transcriber.transcribe(interaction.ticket.id_ticket, message).catch(console.error); // Command should not abort just because the event was not logged

    await interaction.editReply("Close request denied.");
    await interaction.message.edit(getRequestDeniedPayload(interaction.user));

}

async function onAccept(interaction) {

    const ticketCreatorId = interaction.ticket.user.discord_id;
    if (ticketCreatorId != interaction.userId)
        return interaction.editReply(getNotAllowedPayload(ticketCreatorId, await interaction.member.hasPermission("staff")));

    const transcriber = interaction.client.support.transcriber;
    const message = { ...interaction, createdTimestamp: interaction.createdTimestamp, author: interaction.user, content: "accepted the close request" }
    await transcriber.transcribe(interaction.ticket.id_ticket, message).catch(console.error); // Command should not abort just because the event was not logged
    
    await interaction.client.support.closeTicket(interaction.channel, interaction.ticket, interaction.user)

}

function getNotAllowedPayload(ticketCreatorId, isStaffMember) {

    const embed = new MessageEmbed()
        .setColor("#2F3136")
        .setTitle(`Error`)
        .setDescription(
            `Only <@${ticketCreatorId}> can close this ticket.` 
            + (isStaffMember ? ` Since you are part of the staff team you could force close this ticket with the **/forceclose** command.` : ``)
        ).setTimestamp();

    return { embeds: [embed] };

}

function getRequestDeniedPayload(user) {

<<<<<<< HEAD
    return SupportResponseMessageBuilder.missingPermissionsMessage(
        `Only ${ticketCreator?.getMention('**') ?? 'unknown-user'} can make this decision.`
    );
=======
    const embed = new MessageEmbed()
        .setColor("#ff2445")
        .setTitle(`Close Request Denied`)
        .setDescription(`${user} has denied the close request.`)
        .setTimestamp();
>>>>>>> main

    return { content: null, embeds: [embed], components: [] };
    
}

module.exports = onComponent;