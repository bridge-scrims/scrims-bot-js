const { SlashCommandBuilder, SlashCommandStringOption, SlashCommandUserOption } = require("@discordjs/builders");
const { default: parseDuration } = require("parse-duration");
const SupportResponseMessageBuilder = require("./responses");
const ScrimsTicket = require("../lib/scrims/ticket");

const onSupportAction = require("./components");
const UserError = require("../lib/tools/user_error");

const commandHandlers = {

    "support-message": supportMessage,
    "support-ticket": supportTicket,
    "close": requestTicketClosure,
    'support': onSupportAction,
    
}
async function onCommand(interaction) {

    const handler = commandHandlers[interaction.commandName]
    if (handler) return handler(interaction);
    
    throw new Error(`Interaction with name '${interaction.commandName}' does not have a handler!`, commandHandlers);

}

/**
 * @param { import("../types").ScrimsCommandInteraction } interaction 
 */
async function getSupportRole(interaction) {

    const errorMessage = `To send this message you first need to add a role connected to the support position!`
    
    const positionRoles = await interaction.client.database.positionRoles.fetch({ guild_id: interaction.guild.id, position: { name: 'support' } })
    if (positionRoles.length === 0) return interaction.reply(SupportResponseMessageBuilder.errorMessage(`No Support Role`, errorMessage)).then(() => false);

    const role = interaction.guild.roles.resolve(positionRoles[0].role_id)
    if (!role) return interaction.reply(SupportResponseMessageBuilder.errorMessage(`Invalid Support Role`, errorMessage)).then(() => false);

    return role;

}

/**
 * @param { import("../types").ScrimsCommandInteraction } interaction 
 */
async function supportMessage(interaction) {

    const supportRole = await getSupportRole(interaction)
    if (!supportRole) return false;

    await interaction.channel.send(SupportResponseMessageBuilder.supportInfoMessage(supportRole))
    await interaction.reply({ content: "Message created.", ephemeral: true })

}

/**
 * @param { import("../types").ScrimsCommandInteraction } interaction 
 */
async function requestTicketClosure(interaction) {

    const reason = interaction.options.getString('reason') ?? "no reason provided";
    const timeout = interaction.options.getString('timeout') ?? null;

    if (!interaction.channel) return false;
    const ticket = await interaction.client.support.getTicket(interaction.channelId)
    if (!ticket) return interaction.reply(SupportResponseMessageBuilder.missingTicketMessage());

    if (ticket.id_user === interaction.scrimsUser.id_user) {
        // Creator wants to close the ticket, so close it
        return closeTicket(interaction, ticket, `closed this request because of ${reason}`);
    }

    if (interaction.options.getBoolean('force')) {
        // Someone is using the force, so we must comply
        return closeTicket(interaction, ticket, `closed this request with force because of ${reason}`);
    }

    if (timeout) { 
        const duration = parseDuration(timeout)
        if (!duration || duration <= 0 || duration > (30*24*60*60*1000)) 
            throw new UserError("Invalid Timeout", "Please use a valid duration greater then 0 and less then a month and try again.");
        
        const message = await interaction.reply({ ...SupportResponseMessageBuilder.closeRequestMessage(interaction.user, reason, ticket, duration), fetchReply: true })
        const closeCall = () => interaction.client.support.closeTicket(ticket, interaction.user, interaction.user, `had this ticket closed because of ${reason} automatically after ${timeout}`).catch(console.error)
        interaction.client.support.closeRequestTimeouts[message.id] = setTimeout(closeCall, duration)
        const existing = interaction.client.support.ticketCloseRequest[ticket.id_ticket] ?? []
        interaction.client.support.ticketCloseRequest[ticket.id_ticket] = [message.id, ...existing]
    }else {
        await interaction.reply(SupportResponseMessageBuilder.closeRequestMessage(interaction.user, reason, ticket))
    }

}

/**
 * @param { import("../types").ScrimsInteraction } interaction 
 * @param { ScrimsTicket } ticket
 * @param { string } content
 */
async function closeTicket(interaction, ticket, content) {

    await interaction.reply({ content: `Support ticket closing...` })
    
    await interaction.client.support.closeTicket(ticket, interaction.user, interaction.user, content)

}

/**
 * @param { import("../types").ScrimsCommandInteraction } interaction 
 */
async function supportTicket(interaction) {

    const ticket = await interaction.client.support.getTicket(interaction.channel.id)
    if (!ticket) return interaction.reply(SupportResponseMessageBuilder.missingTicketMessage());

    const user = interaction.options.getUser("user");
    const operation = interaction.options.getString("operation");
    const operactionPreposition = ((operation === "add") ? "to" : "from")
    
    const permissionOverwrites = interaction.channel.permissionOverwrites;
    const userPermission = Object.fromEntries(['SEND_MESSAGES', 'VIEW_CHANNEL', 'READ_MESSAGE_HISTORY'].map(perm => [perm, (operation === "add")]))
    
    const result = await permissionOverwrites.edit(user, userPermission).catch(error => error)
    if (result instanceof Error) {

        console.error(`Unable to ${operation} ${user?.tag} from ticket because of ${result}!`, userPermission, ticket)
        return interaction.reply(SupportResponseMessageBuilder.failedMessage(`${operation} ${user} ${operactionPreposition} this ticket`));

    }

    const pastTenseOperation = (operation.endsWith('e') ? `${operation}d` : `${operation}ed`) 
    const action = `has been ${pastTenseOperation} ${operactionPreposition} the ticket!`
    
    const logMessage = { id: interaction.id, createdTimestamp: interaction.createdTimestamp, author: interaction.user, content: `${user.tag} ${action}` }
    await interaction.client.support.transcriber.transcribe(ticket.id_ticket, logMessage).catch(console.error)

    await interaction.reply(SupportResponseMessageBuilder.actionsCompletedMessage(user, operation, action))

}

function buildCloseCommand() {

    const closeCommand = new SlashCommandBuilder()
        .setName("close")
        .setDescription("Use this command in a support channel to request a ticket closure.")
        .addStringOption(option => (
            option
                .setName('reason')
                .setDescription('The reason for this request.')
                .setRequired(false)
        ))
        .addBooleanOption(option => (
            option
                .setName('force')
                .setDescription('If you would like to use the force or not.')
                .setRequired(false)
        ))
        .addStringOption(option => (
            option
                .setName('timeout')
                .setDescription('Time until this ticket should auto close (e.g. 1d 20hours 3min).')
                .setRequired(false)
        ))


    return [closeCommand, { positionLevel: "support" }, { forceGuild: true, denyWhenBlocked: true, forceScrimsUser: true }];

}

function buildSupportMessageCommand() {

    const supportMessageCommand = new SlashCommandBuilder()
        .setName("support-message")
        .setDescription("Sends the support message in the channel.")

    return [supportMessageCommand, { positionLevel: "support" }, { forceGuild: true, forceScrimsUser: false }];

}

function buildSupportTicketCommand() {

    const supportTicketOptionCommand = new SlashCommandBuilder()
        .setName("support-ticket")
        .setDescription("Adds or removes a user from the ticket")
        .addStringOption(new SlashCommandStringOption()
            .setName("operation")
            .setDescription("Add/Remove a user from a ticket.")
            .addChoices({ name: "Add", value: "add" }, { name: "Remove", value: "remove" })
            .setRequired(true)
        )
        .addUserOption(new SlashCommandUserOption()
            .setName("user")
            .setDescription("The user to add/remove")
            .setRequired(true)
        )

    return [supportTicketOptionCommand, { positionLevel: "support" }, { forceGuild: true, forceScrimsUser: false }];
    
}


module.exports = {

    commandHandler: onCommand,
    commands: [ buildCloseCommand(), buildSupportMessageCommand(), buildSupportTicketCommand() ]

}