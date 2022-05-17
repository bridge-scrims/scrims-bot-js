const { MessageEmbed, MessageActionRow, MessageButton, Role, User, TextInputComponent, Modal } = require("discord.js");
const MemoryMessageButton = require("../lib/memory_button");
const ScrimsMessageBuilder = require("../lib/responses");
const ScrimsTicket = require("../lib/scrims/ticket");
const ScrimsTicketType = require("../lib/scrims/ticket_type");

class SupportResponseMessageBuilder extends ScrimsMessageBuilder {

    static supportInfoEmbed(supportRole) {
        
        return new MessageEmbed()
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
                        .setMinLength(8)
                        .setMaxLength(100)
                        .setPlaceholder('first#1011 second#2022 third#3033 ...')
                        .setRequired(true)
                )
            )

        }

        const reasonLabel = (type.name !== 'report') ? 'Why are you opening a ticket?' : 'What are you reporting these people for?'

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

    static ticketConfirmMessage(i18n, client, ticketData) {

        const actions = new MessageActionRow()
            .addComponents(
                new MemoryMessageButton(client, ticketData).setCustomId('support/sendTicket/CREATE').setLabel('Create').setStyle('SUCCESS'),
                new MemoryMessageButton(client, ticketData).setCustomId('support/sendTicket/REOPEN').setLabel('Edit').setStyle('PRIMARY'),
                this.cancelButton(i18n)
            )

        const test = (ticketData.reason === "testing the ticket system without pinging the bridge scrims support team") 
        const reasonLabel = (ticketData.type.name !== 'report') ? 'Why are you opening a ticket?' : 'What are you reporting these people for?'
        const embed = new MessageEmbed()
            .setTitle(`Ticket Create Confirmation`)
            .setDescription(`Please verify that all fields are filled to your liking, then create this ticket using the button below.`)
            .setColor('#ffffff')

        if (ticketData.targets && ticketData.targets.length > 0) embed.addField('Who are you reporting?', this.stringifyArray(ticketData.targets.map(v => v?.id ? `${v} (${v.id})` : v)))
        if (ticketData.reason) embed.addField(reasonLabel, `\`\`\`${ticketData.reason}\`\`\``)

        const content = (test ? ' *(Test ticket detected)*' : null)
        return { content, embeds: [embed], components: [actions], ephemeral: true };

    }

    static ticketInfoMessage(member, mentionRoles, supportRole, ticketData) {

        const test = (ticketData.reason === "testing the ticket system without pinging the bridge scrims support team") 
        const reasonLabel = (ticketData.type.name !== 'report') ? 'Why are you opening a ticket?' : 'What are you reporting these people for?'

        const embed = new MessageEmbed()
            .setTitle(`${ticketData.type.capitalizedName} Ticket`)
            .setDescription(`👋 **Welcome** ${member} to your ticket channel. The bridge scrims ${supportRole ?? 'support'} team have been alerted and will be with you shortly.`)
            .setColor(supportRole?.hexColor || '#ff9d00')
            .setFooter({ text: `Managed by the support team`, iconURL: supportRole?.iconURL() })
            .setTimestamp()

        if (ticketData.targets && ticketData.targets.length > 0) embed.addField('Who are you reporting?', this.stringifyArray(ticketData.targets.map(v => v?.id ? `${v} (${v.id})` : v)))
        if (ticketData.reason) embed.addField(reasonLabel, `\`\`\`${ticketData.reason}\`\`\``)

        const content = (mentionRoles.length > 0 ? `||${member} ${mentionRoles.join(' ')}||\n` : `||${member}||`)
        return { content, embeds: [embed], allowedMentions: { roles: (test ? [] : mentionRoles.map(v => v.id)), users: [member.id] } };

    }
    
}

module.exports = SupportResponseMessageBuilder;