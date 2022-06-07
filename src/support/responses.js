const { MessageEmbed, MessageActionRow, MessageButton, Role, User, TextInputComponent, Modal, GuildMember } = require("discord.js");
const MemoryMessageButton = require("../lib/components/memory_button");
const ScrimsMessageBuilder = require("../lib/responses");
const ScrimsTicket = require("../lib/scrims/ticket");
const ScrimsTicketType = require("../lib/scrims/ticket_type");
const TicketCreateExchange = require("./ticket_create_exchange");

class SupportResponseMessageBuilder extends ScrimsMessageBuilder {

    /**
     * @param { Role } supportRole 
     */
    static supportInfoEmbed(supportRole) {
        
        return new MessageEmbed()
            .setColor(supportRole.hexColor)
            .setTitle(`${supportRole.guild.name} Support and Report`)
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
                + `Sending montages are for **privates** and above!`
            ).setFooter({ text: `Managed by the support team`, iconURL: supportRole.iconURL() })

    }

    static supportInfoActions() {

        return new MessageActionRow()
            .addComponents(

                new MessageButton().setCustomId("support/ticketCreate/support").setLabel("Support").setEmoji("📩").setStyle(1),
                new MessageButton().setCustomId("support/ticketCreate/report").setLabel("Report").setEmoji("⚖️").setStyle(4)

            )

    }

    /**
     * @param { Role } supportRole 
     */
    static supportInfoMessage(supportRole) {

        return { embeds: [ this.supportInfoEmbed(supportRole) ], components: [ this.supportInfoActions() ] }

    }

    static missingTicketMessage() {

        return this.errorMessage('Unknown Ticket', `This command can only be used in ticket channels.`);

    }

    static closeRequestActions(userId, ticketId) {

        return new MessageActionRow()
            .addComponents([
    
                new MessageButton()
                    .setCustomId(`support/ticketClose/${ticketId}/${userId}/ACCEPT`)
                    .setLabel("Accept & Close")
                    .setStyle("PRIMARY"),
    
                new MessageButton()
                    .setCustomId(`support/ticketClose/${ticketId}/${userId}/DENY`)
                    .setLabel("Deny & Keep Open")
                    .setStyle("SECONDARY"),

                new MessageButton()
                    .setCustomId(`support/ticketClose/${ticketId}/${userId}/FORCE`)
                    .setLabel("Force Close")
                    .setStyle("DANGER")
    
            ])
    
    }
    
    static closeRequestEmbed(user, reason) {
    
        return new MessageEmbed()
            .setColor("#5D9ACF")
            .setTitle("Close Request")
            .addField("Reason", `\`\`\`${reason}\`\`\``, false)
            .setDescription(`${user} has requested to close this ticket. Please accept or deny using the buttons below.`)
            .setTimestamp()

    }

    /**
     * @param { User } user 
     * @param { string } reason 
     * @param { ScrimsTicket } ticket 
     */
    static closeRequestMessage(user, reason, ticket) {

        const content = (ticket.user) ? ticket.user.getMention('**') : null
        const embed = this.closeRequestEmbed(user, reason)
        const actions = this.closeRequestActions(user.id, ticket.id_ticket)

        return { content, embeds: [embed], components: [actions] };

    }

    static actionsCompletedMessage(user, operation, action) {

        const embed = new MessageEmbed()
            .setTitle("Action Completed")
            .setDescription(`${user} ${action}`)
            .setColor((operation === "add") ? this.successGreen : this.errorRed)
            .setTimestamp()

        return { embeds: [embed], components: [], content: null };

    }

    /**
     * @param { ScrimsTicketType } type 
     */
    static ticketCreateModal(type, wasReopened=false) {

        const modal = new Modal()
            .setCustomId(`support/ticketModalSubmit/${type.id_type}/${wasReopened ? 'REOPEN' : ''}`)
            .setTitle(`${type.capitalizedName} Ticket`)

        if (type.name === 'report') {

            modal.addComponents(
                new MessageActionRow().addComponents(
                    new TextInputComponent()
                        .setCustomId('targets')
                        .setLabel('Who are you reporting?')
                        .setStyle('SHORT')
                        .setMinLength(4)
                        .setMaxLength(100)
                        .setPlaceholder('first#1011 second#2022 third#3033 ...')
                        .setRequired(true)
                )
            )

        }

        const reasonLabel = (type.name !== 'report') ? 'Why are you opening a ticket?' : 'Why are you creating this report?'

        modal.addComponents(
            new MessageActionRow().addComponents(
                new TextInputComponent()
                    .setCustomId('reason')
                    .setLabel(reasonLabel)
                    .setStyle('PARAGRAPH')
                    .setMinLength(8)
                    .setMaxLength(1000)
                    .setPlaceholder('Write here')
                    .setRequired(true)
            )
        )

        return modal;

    }

    static ticketTargetsMissingContent() {
        return '⛔ **Please let us know who you are reporting!**';
    }

    static ticketReasonMissingContent() {
        return '⛔ **Please let us know why you are creating this ticket!**';
    }

    static ticketConfirmMessage(i18n, client, ticketData) {

        const actions = new MessageActionRow()
            .addComponents(
                new MemoryMessageButton(client, ticketData).setCustomId('support/sendTicket/CREATE').setLabel('Create').setStyle('SUCCESS'),
                new MemoryMessageButton(client, ticketData).setCustomId('support/sendTicket/REOPEN').setLabel('Edit').setStyle('PRIMARY'),
                this.cancelButton(i18n)
            )

        const test = (ticketData.reason === "testing the ticket system without pinging the bridge scrims support team") 
            || (ticketData.reason === "testing the ticket system without pinging support") 

        const reasonLabel = (ticketData.type.name !== 'report') ? 'Why are you opening a ticket?' : 'Why are you creating this report?'
        const embed = new MessageEmbed()
            .setTitle(`Ticket Create Confirmation`)
            .setDescription(`Please verify that all fields are filled to your liking, then create this ticket using the button below.`)
            .setColor('#ffffff')

        if (ticketData.targets) embed.addField('Who are you reporting?', (ticketData.targets.length > 0) ? this.stringifyArray(ticketData.targets.map(v => v?.id ? `${v} (${v.id})` : v)) : '``` ```'+this.ticketTargetsMissingContent())
        if (ticketData.reason) embed.addField(reasonLabel, (ticketData.reason.length > 0) ? `\`\`\`${ticketData.reason}\`\`\`` : '``` ```'+this.ticketReasonMissingContent())

        const content = (test ? ' *(Test ticket detected)*' : null)
        return { content, embeds: [embed], components: [actions], ephemeral: true };

    }

    /**
     * @param { TicketCreateExchange } exchange 
     */
    static ticketInfoMessage(exchange, mentionRoles, supportRole) {

        const embed = new MessageEmbed()
            .setTitle(`${exchange.ticketType.capitalizedName} Ticket`)
            .setDescription(`👋 **Welcome** ${exchange.creator} to your ticket channel. The ${exchange.guild.name.toLowerCase()} ${supportRole ?? '**@support**'} team have been alerted and will be with you shortly.`)
            .setColor(supportRole?.hexColor || '#ff9d00')
            .setFooter({ text: `Managed by the support team`, iconURL: supportRole?.iconURL() })
            .setFields(exchange.getEmbedFields())
            .setTimestamp()

        const content = (mentionRoles.length > 0 ? `||${exchange.creator} ${mentionRoles.join(' ')}||\n` : `||${exchange.creator}||`)
        return { content, embeds: [embed], allowedMentions: { roles: (exchange.isTest() ? [] : mentionRoles.map(v => v.id)), users: [exchange.creator.discord_id] } };

    }
    
}

module.exports = SupportResponseMessageBuilder;