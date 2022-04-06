const { SlashCommandBuilder, SlashCommandStringOption, SlashCommandUserOption } = require("@discordjs/builders");
const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const ScrimsMessageBuilder = require("../lib/responses");

const commandHandlers = {
    "close": requestTicketClosure,
    "forceclose": forceCloseTicket,
    "support-message": supportMessage,
    "support-ticket": supportTicket
}
async function onCommand(interaction) {

    const handler = commandHandlers[interaction.commandName]
    if (handler) {

        // hold on a minuite, isn't the commandes guild commands @whatcats
        if (!interaction.guild) return interaction.reply(ScrimsMessageBuilder.guildOnlyMessage());

        return handler(interaction);

    }

}

async function getSupportRole(interaction) {

    const positionRoles = await interaction.client.database.positionRoles.get({ guild_id: interaction.guild.id, position: { name: 'support' } })
    if (positionRoles.length === 0) {

        return interaction.reply(
            ScrimsMessageBuilder.errorMessage(`No Support Role`, `To send this message you first need to add a role connected to the support position!`)
        ).then(() => false);

    }

    const role = interaction.guild.roles.resolve(positionRoles[0].role_id)
    if (!role) {

        return interaction.reply(
            ScrimsMessageBuilder.errorMessage(`Invalid Support Role`, `To send this message you first need to add a role connected to the support position!`)
        ).then(() => false);

    }

    return role;

}

async function supportMessage(interaction) {

    const supportRole = await getSupportRole(interaction)
    if (!supportRole) return false;

    const action = new MessageActionRow()
        .addComponents(

            new MessageButton()
                .setCustomId("support")
                .setLabel("Support")
                .setEmoji("📩")
                .setStyle(1),

            new MessageButton()
                .setCustomId("report")
                .setLabel("Report")
                .setEmoji("⚖️")
                .setStyle(4)

        );

    const embed = new MessageEmbed()
        .setColor(supportRole.hexColor)
        .setTitle("Bridge Scrims Support and Report")
        .setDescription(`Get in contact with the ${supportRole} team here.`)
        .addField(`Report Tickets`, `Report user(s) for breaking in-game rules, discord rules, or being troublemakers.`)
        .addField(`Support Tickets`, `Ask questions, post tournaments, post overlays, etc.`)
        .addField(
            `Hints`,
            `If you are trying to send a tournament make sure that you have a gamemode, `
            + `a prize, and a discord server setup with proper roles/permissions/channels.`
            + `\n _ _ \n`
            + `If you are sending an overlay make sure you have an image/video, and a MediaFire `
            + `link for your pack. If the video has anything not allowed in the rules you will be `
            + `banned and if the MediaFire download is a virus you will be banned. `
            + `\n _ _ \n`
            + `If you are sending a montage make sure that it is in cooperation with rules and if `
            + `there is NSFW, racism, etc. you will be blacklisted from sending montages. `
            + `Sending montages are for **privates** and Above!`
        ).setFooter({ text: `Managed by the support team`, iconURL: supportRole.iconURL() })

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

    return { content: `<@${ticket.user.discord_id}>`, embeds: [embed], components: [getCloseRequestActions(ticket.id_ticket)] };

}

async function closeTicket(interaction, ticket, content) {

    await interaction.reply({ content: `Support ticket closing...` })

    const message = { ...interaction, createdTimestamp: interaction.createdTimestamp, author: interaction.user, content }
    await interaction.client.support.transcriber.transcribe(ticket.id_ticket, message)

    await interaction.client.support.closeTicket(interaction.channel, ticket)

}

async function forceCloseTicket(interaction) {

    const ticketTable = interaction.client.database.tickets;
    const ticket = ticketTable.cache.get({ channel_id: interaction.channel.id })[0]
    if (!ticket) return interaction.reply(getMissingTicketPayload()); // This is no support channel (bruh moment)

    await closeTicket(interaction, ticket, "forcibly closed this request")

}

async function supportTicket(interaction) {

    const ticketTable = interaction.client.database.tickets;
    const ticket = ticketTable.cache.get({ channel_id: interaction.channel.id })[0]
    if (!ticket) return interaction.reply(getMissingTicketPayload()); // This is no support channel (bruh moment) (good commenting whatcats)
    // I know you like the const keyword :)
    const user = interaction.options.getMember("user", true);
    const operation = interaction.options.getString("operation", true);

    const permissionOverwrites = interaction.channel.permissionOverwrites;
    if (operation === "added") {
        await permissionOverwrites.edit(user, {
            'SEND_MESSAGES': true,
            'READ_MESSAGES': true,
        })
    } else {
        // remove the user from the ticket
        await permissionOverwrites.edit(user, {
            'SEND_MESSAGES': false,
            'READ_MESSAGES': false,
        })
    }
    const embed = new MessageEmbed(user, operation)
        .setColor("#FF2445")
        .setTitle("Action Completed!")
        .setDescription(`The user ${user.tag} has been ${operation} to the ticket!`)
        .setTimestamp()
    interaction.reply({ embeds: [embed] });
}



function getMissingTicketPayload() {

    const embed = new MessageEmbed()
        .setColor("#FF2445")
        .setTitle("Error")
        .setDescription("This isn't a ticket channel!")
        .setTimestamp()

    return { embeds: [embed], ephemeral: true };

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

    return [closeCommand, { permissionLevel: "support" }];

}

function buildForceCloseCommand() {

    const forceCloseCommand = new SlashCommandBuilder()
        .setName("forceclose")
        .setDescription("Use this command in a support channel to force a ticket closure.")

    return [forceCloseCommand, { permissionLevel: "staff" }];

}

function buildSupportMessageCommand() {

    const supportMessageCommand = new SlashCommandBuilder()
        .setName("support-message")
        .setDescription("Sends the support message in the channel.")

    return [supportMessageCommand, { permissionLevel: "support" }];

}

function buildSupportTicketCommand() {

    const supportTicketOptionCommand = new SlashCommandBuilder()
        .setName("support-ticket")
        .setDescription("Adds or removes a user from the ticket")
        .addStringOption(new SlashCommandStringOption()
            .setName("operation")
            .setDescription("Add/Remove a user from a ticket.")
            .addChoice("Add", "added")
            .addChoice("Remove", "removed")
            .setRequired(true)
        )
        .addUserOption(new SlashCommandUserOption()
            .setName("user")
            .setDescription("The user to add/remove")
            .setRequired(true)
        )

    return [supportTicketOptionCommand, { permissionLevel: "support" }];
}


module.exports = {

    commandHandler: onCommand,
    commands: [buildCloseCommand(), buildForceCloseCommand(), buildSupportMessageCommand(), buildSupportTicketCommand()]

}