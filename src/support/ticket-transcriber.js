const { MessageEmbed, MessageAttachment, Message } = require("discord.js");
const { default: got } = require("got/dist/source");
const ScrimsAttachment = require("../lib/scrims/attachment");
const ScrimsTicketMessage = require("../lib/scrims/ticket_message");
const ScrimsTicketMessageAttachment = require("../lib/scrims/ticket_message_attachment");

class TicketTranscriber {

    constructor(database) {

        /**
         * @type { import("../lib/postgresql/database") }
         */
        this.client = database 

    }
    
    async transcribe(ticketId, message) {

        if (message instanceof Message) {

            message.mentions.users.forEach(mentionedUser => message.content = message.content.replaceAll(`<@${mentionedUser.id}>`, `@${mentionedUser.tag}`))
            
            const notAddedAttachments = message.attachments.filter(value => !this.client.attachments.cache.find({ attachment_id: value.id }))
            
            Promise.all(notAddedAttachments.map(value => got(value.url).catch(console.error)))
            await Promise.all(
                notAddedAttachments.map(value => this.client.attachments.create(ScrimsAttachment.fromMessageAttachment(this.client, value)).catch(console.error))
            )

            await Promise.all(
                message.attachments.filter(value => !this.client.ticketMessageAttachments.cache.find({ id_ticket: ticketId, attachment_id: value.id }))
                    .map(value => (
                        this.client.ticketMessageAttachments.create(
                            new ScrimsTicketMessageAttachment(this.client)
                                .setTicket(ticketId).setMessage(message).setAttachment(value)
                        ).catch(console.error)
                    ))
            )

            if (!message.content && message.embeds?.length === 1) {
                message.content = message.embeds[0]?.title || message.embeds[0]?.author?.name || ''
            }
            
        }

        await this.client.ticketMessages.create(
            new ScrimsTicketMessage(this.client)
                .setTicket(ticketId).setMessage(message).setContent(message.content)
                .setReferenceId(message?.reference?.messageId ?? null)
                .setAuthor(message.author).setCreatedPoint()
        )

    }

    getHTMLContent(guild, ticketMessages) {

        // Prevent html injections
        const escape = (value) => value.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/`/g, "\\`");
        
        const getMessageExtra = (message) => message.edits ? `<div class="extra edited">(edited)</div>` : (message.deleted ? `<div class="extra deleted">(deleted)</div>` : ``)
        const getMessageAttachments = (message) => message.attachments.length > 0 ? `<div class="attachment">\nAttachments: ${message.attachments.map(attachment => `<a href="${attachment.url}" target="_blank" rel="noopener noreferrer">${attachment.filename ?? attachment.discord_id}</a>`).join(' | ')}</div>` : '';

        // Will make everything look pretty
        const style = (
            `body { margin: 20px; }`
            + `.extra { font-size: 10px }`
            + `.attachment { font-size: 13px }`
            + `.deleted { color: #FF0000 }`
            + `.edited { color: #909090 }`
            + `.table { width: auto; }`
            + `th { background: #A14F50; color: #FFFFFF }`
            + `td { white-space: nowrap; }`
            + `td.last { white-space: normal; width: 100%; }`
            + `h1 { color: #A14F50; margin-bottom: 16px; }`
        )

        // Adds all the data dynamically using the browsers timezone
        const script = (
            `$( document ).ready(() => onReady());`
            + `function onReady() {`
                + `const tableBody = $("#transcript-table-body");`
                + `const clientOptions = Intl.DateTimeFormat().resolvedOptions();`
                + `function getDate(timestamp) { return (new Date(timestamp)).toLocaleString(clientOptions.locale, { timeZone: clientOptions.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }) };`
                + `function getTime(timestamp) { return (new Date(timestamp)).toLocaleString(clientOptions.locale, { timeZone: clientOptions.timeZone, hour: "numeric", minute: "numeric" }) };`
                + ticketMessages.map(message => (
                    `tableBody.append(\``
                        + `<tr>`
                            + `<td>\${getDate(${message.created_at*1000})}</td>`
                            + `<td>\${getTime(${message.created_at*1000})}</td>`
                            + `<td>${escape(message.author.tag)}</td>`
                            + `<td class="last">${escape((message?.edits?.slice(-1)?.[0] ?? message).content)}${getMessageAttachments(message)}${getMessageExtra(message)}</td>`
                        + `</tr>` 
                    + `\`);`
                )).join("")
            + `}`
        )

        // Includes bootstrap & jquery bcs noice
        const head = (
            `<meta charset="UTF-8">`
            + `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.0.0/dist/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">`
            + `<script src="https://code.jquery.com/jquery-3.2.1.slim.min.js" integrity="sha384-KJ3o2DKtIkvYIK3UENzmM7KCkRr/rE9/Qpg6aAZGJwFDMVNA/GpGFF93hXpG5KkN" crossorigin="anonymous"></script>`
            + `<script src="https://cdn.jsdelivr.net/npm/popper.js@1.12.9/dist/umd/popper.min.js" integrity="sha384-ApNbgh9B+Y1QKtv3Rn7W3mgPxhU9K/ScQsAP7hUibX39j7fakFPskvXusvfa0b4Q" crossorigin="anonymous"></script>`
            + `<script src="https://cdn.jsdelivr.net/npm/bootstrap@4.0.0/dist/js/bootstrap.min.js" integrity="sha384-JZR6Spejh4U02d8jOt6vLEHfe/JQGiRRSQQxSfFWpi1MquVdAyjUar5+76PVCmYl" crossorigin="anonymous"></script>`
            + `<title>${guild.name} Ticket Transcript</title>`
            + `<script>${script}</script>`
            + `<style>${style}</style>`
        )

        // Create a template to insert all the data into
        const body = (
            `<h1>Ticket Transcript</h1>`
            + `<table class="table table-striped">`
                + `<thead>`
                    + `<tr>`
                        + `<th scope="col">Date</th>`
                        + `<th scope="col">Time</th>`
                        + `<th scope="col">Author</th>`
                        + `<th scope="col">Message Content</th>`
                    + `</tr>`
                + `</thead>`
                + `<tbody id="transcript-table-body"></tbody>`
            + `</table>`
        )

        // Wrap everything together and return it
        return (
            `<!DOCTYPE html>`
                + `<html>`
                    + `<head>${head}</head>`
                    + `<body>${body}</body>`
                + `</html>`
        );

    }

    async getTicketMessages(ticket) {

        const messageAttachments = await this.client.ticketMessageAttachments.getArrayMap({}, ['message_id'], false)
        const allMessages = await this.client.ticketMessages.fetch({ id_ticket: ticket.id_ticket }, false)
        allMessages.sort((a, b) => a.created_at - b.created_at).forEach((v, idx, arr) => {
            const existing = arr.filter(msg => msg.message_id === v.message_id)[0]
            if (existing && existing !== v) {
                existing.edits = [ ...(existing.edits ?? []), v ]
                delete allMessages[idx]
            }
        })
        allMessages.forEach(msg => msg.attachments = (messageAttachments[msg.message_id] ?? []).map(value => value.attachment))
        return allMessages.sort((a, b) => a.created_at - b.created_at);

    }

    getUserMessageEmbed(ticket) {

        return new MessageEmbed()
            .setColor("#A14F50")
            .setTitle(`${ticket?.type?.capitalizedName} Ticket Transcript`)
            .setDescription(
                `Your ${ticket?.type?.name} ticket from <t:${ticket.created_at}:f> was closed. `
                + `Attached to this message you will find the message log of your ${ticket?.type?.name} channel. `
                + `Hopefully we were able to help you. Have a nice day :)`
            )
            .setFooter({ text: ticket?.discordGuild?.name, iconURL: ticket?.discordGuild?.iconURL({ dynamic: true }) })

    }

    getLogMessageEmbed(ticket) {

        return new MessageEmbed()
            .setColor("#FFFFFF")
            .setTitle(`${ticket?.type?.capitalizedName} Ticket Transcript`)
            .setDescription(
                `Ticket created by ${ticket?.user?.getMention('**')} with a ticket id of **${ticket.id_ticket}**.`
            )
            .setFooter({ text: ticket?.discordGuild?.name, iconURL: ticket?.discordGuild?.iconURL({ dynamic: true }) })

    }

    async send(guild, ticket) {
        
        try {

            const ticketMessages = await this.getTicketMessages(ticket)
            const transcriptContent = this.getHTMLContent(guild, ticketMessages)

            const buff = Buffer.from(transcriptContent, "utf-8");
            const file = new MessageAttachment(buff, `${guild.name.replace(/ /g, '_')}_Support_Transcript_${ticket.id_ticket.replace(/-/g, '_')}.html`);

            const channel = guild.client.support.getTranscriptChannel(guild.id)
            if (channel) await channel.send({ embeds: [this.getLogMessageEmbed(ticket)], files: [file] });
            
            const user = await guild.client.users.fetch(ticket.user.discord_id)
                .catch(error => this.onUserDMMissed(channel, ticket?.user?.discord_id, `${error}`).then(() => null))
            
            if (user !== null) 
                await user.send({ embeds: [this.getUserMessageEmbed(ticket)], files: [file] }).catch(error => this.onUserDMMissed(channel, ticket?.user?.discord_id, `${error}`));

        }catch(error) {

            console.error(error)
            
        }

    }

    async onUserDMMissed(channel, userId, reason) {

        if (!channel) return false;
        return channel.send(`Couldn't DM <@${userId}> because of \`${reason}\`!`).catch(console.error);
        
    }

}

module.exports = TicketTranscriber;